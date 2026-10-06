from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import repos, metrics

app = FastAPI(title="Repo Analysis Tool", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(repos.router, prefix="/api/repos", tags=["repositories"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])

@app.get("/")
async def root():
    return {"message": "Repo Analysis Tool API"}
