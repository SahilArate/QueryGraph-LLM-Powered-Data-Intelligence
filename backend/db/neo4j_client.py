import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USERNAME"), os.getenv("NEO4J_PASSWORD"))
)

def get_session():
    return driver.session()

def run_query(cypher: str, params: dict = {}):
    with driver.session() as session:
        result = session.run(cypher, params)
        return [dict(record) for record in result]

def test_connection():
    with driver.session() as session:
        result = session.run("RETURN 1 as test")
        return result.single()["test"] == 1