from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.postgres import execute_query
from llm.groq_client import check_guardrail, generate_sql, generate_answer

router = APIRouter()

class QueryRequest(BaseModel):
    question: str
    conversation_history: list = []

@router.post("/query")
async def query_data(req: QueryRequest):
    # Guardrail check
    if not check_guardrail(req.question):
        return {
            "answer": "This system is designed to answer questions related to the SAP Order-to-Cash dataset only. Please ask questions about sales orders, deliveries, billing, payments, or products.",
            "sql": None,
            "results": [],
            "blocked": True
        }

    # Generate SQL
    sql = generate_sql(req.question, req.conversation_history)

    # Execute query
    try:
        results = execute_query(sql)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generate natural language answer
    answer = generate_answer(req.question, sql, results)

    return {
        "answer": answer,
        "sql": sql,
        "results": results,
        "blocked": False
    }