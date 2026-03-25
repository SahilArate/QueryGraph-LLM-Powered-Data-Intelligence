from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from db.postgres import execute_query
from llm.groq_client import check_guardrail, generate_sql, generate_answer, should_use_trace, extract_billing_id
import httpx
import json
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

router = APIRouter()


class QueryRequest(BaseModel):
    question: str
    conversation_history: list = []


@router.post("/query")
async def query_data(req: QueryRequest):
    if not check_guardrail(req.question):
        return {
            "answer": "This system is designed to answer questions related to the SAP Order-to-Cash dataset only. Please ask questions about sales orders, deliveries, billing, payments, or products.",
            "sql": None, "results": [], "blocked": True
        }

    if should_use_trace(req.question):
        billing_id = extract_billing_id(req.question)
        if billing_id:
            async with httpx.AsyncClient() as http_client:
                resp = await http_client.get(f"http://localhost:8000/api/graph/trace/{billing_id}")
                data = resp.json()
            if "error" in data:
                return {"answer": f"Could not find billing document {billing_id} in the database.", "sql": None, "results": [], "blocked": False}
            flow = data["flow"]
            answer = generate_answer(req.question, f"Dedicated trace query for billing document {billing_id}", [flow])
            return {"answer": answer, "sql": f"-- Trace query for billing document {billing_id}", "results": [flow], "blocked": False}

    sql = generate_sql(req.question, req.conversation_history)
    try:
        results = execute_query(sql)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    answer = generate_answer(req.question, sql, results)
    return {"answer": answer, "sql": sql, "results": results, "blocked": False}


@router.post("/query/stream")
async def query_stream(req: QueryRequest):
    if not check_guardrail(req.question):
        async def blocked_stream():
            yield f"data: {json.dumps({'token': 'This system is designed to answer questions related to the SAP Order-to-Cash dataset only.', 'done': False})}\n\n"
            yield f"data: {json.dumps({'done': True, 'sql': None, 'results': [], 'blocked': True})}\n\n"
        return StreamingResponse(blocked_stream(), media_type="text/event-stream")

    sql = generate_sql(req.question, req.conversation_history)
    try:
        results = execute_query(sql)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    prompt = f"""You are a helpful SAP data analyst. Answer based only on the query results.
User question: {req.question}
SQL executed: {sql}
Query results: {results}
Answer in 2-4 sentences. Be specific with numbers and names from the data.
If results are empty, say no matching records were found."""

    async def stream_response():
        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300, temperature=0.3, stream=True
        )
        for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        yield f"data: {json.dumps({'done': True, 'sql': sql, 'results': results, 'blocked': False})}\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")