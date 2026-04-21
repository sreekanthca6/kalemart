from fastapi import FastAPI
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from .otel import setup_otel
from .routes import insights

setup_otel()

app = FastAPI(title="Kalemart AI Service", version="0.0.1")
FastAPIInstrumentor.instrument_app(app)

app.include_router(insights.router, prefix="/api/insights")

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
