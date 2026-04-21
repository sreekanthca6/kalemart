from fastapi import FastAPI
from otel import setup_otel
from .routes import insights

setup_otel()

app = FastAPI(title="Kalemart AI Service")

app.include_router(insights.router, prefix="/api/insights")

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
