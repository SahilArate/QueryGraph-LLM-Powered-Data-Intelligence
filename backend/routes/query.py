from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.postgres import execute_query
from llm.groq_client import check_guardrail, generate_sql, generate_answer, should_use_trace, extract_billing_id
import httpx

router = APIRouter()


class QueryRequest(BaseModel):
    question: str
    conversation_history: list = []


@router.post("/query")
async def query_data(req: QueryRequest):
    if not check_guardrail(req.question):
        return {
            "answer": "This system is designed to answer questions related to the SAP Order-to-Cash dataset only. Please ask questions about sales orders, deliveries, billing, payments, or products.",
            "sql": None,
            "results": [],
            "blocked": True
        }

    if should_use_trace(req.question):
        billing_id = extract_billing_id(req.question)
        if billing_id:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"http://localhost:8000/api/graph/trace/{billing_id}")
                data = resp.json()

            if "error" in data:
                return {
                    "answer": f"Could not find billing document {billing_id} in the database.",
                    "sql": None,
                    "results": [],
                    "blocked": False
                }

            flow = data["flow"]
            answer = generate_answer(
                req.question,
                f"Dedicated trace query for billing document {billing_id}",
                [flow]
            )
            return {
                "answer": answer,
                "sql": f"-- Trace query for billing document {billing_id}",
                "results": [flow],
                "blocked": False
            }

    sql = generate_sql(req.question, req.conversation_history)

    try:
        results = execute_query(sql)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    answer = generate_answer(req.question, sql, results)

    return {
        "answer": answer,
        "sql": sql,
        "results": results,
        "blocked": False
    }