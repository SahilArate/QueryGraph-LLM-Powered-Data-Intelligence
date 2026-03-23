from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.query import router as query_router
from routes.graph import router as graph_router

app = FastAPI(title="Dodge AI FDE — QueryGraph API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query_router, prefix="/api")
app.include_router(graph_router, prefix="/api")

@app.get("/")
def root():
    return {"status": "ok", "message": "QueryGraph API is running"}