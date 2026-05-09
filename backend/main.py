import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from utils.storage import ensure_dirs

from routers import datasets, cleaning, merge, ai_insights, export_data

app = FastAPI(title="Data Scientist Helper API", version="2.0.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    ensure_dirs()


app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])
app.include_router(cleaning.router, prefix="/api/clean", tags=["cleaning"])
app.include_router(merge.router, prefix="/api/merge", tags=["merge"])
app.include_router(ai_insights.router, prefix="/api/ai", tags=["ai"])
app.include_router(export_data.router, prefix="/api/export", tags=["export"])


@app.get("/")
def root():
    return {"status": "ok", "version": "2.0.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
