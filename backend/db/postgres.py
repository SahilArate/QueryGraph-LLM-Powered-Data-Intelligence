import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

def get_conn():
    return psycopg2.connect(os.getenv("DATABASE_URL"))

def execute_query(sql: str) -> list:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql)
            rows = cur.fetchmany(100)
            return [dict(row) for row in rows]
    except Exception as e:
        raise Exception(f"Query failed: {str(e)}")
    finally:
        conn.close()