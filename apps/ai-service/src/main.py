from fastapi import FastAPI
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry import trace, metrics
from .otel import setup_otel
from .routes import insights, supervisor
import json
import time

setup_otel()

app = FastAPI(title="Kalemart AI Service", version="0.0.1")
FastAPIInstrumentor.instrument_app(app)
meter = metrics.get_meter("kalemart-ai-service", "0.0.1")
requests_total = meter.create_counter("kalemart_ai_http_requests_total")
request_duration_ms = meter.create_histogram("kalemart_ai_http_request_duration_ms", unit="ms")

@app.middleware("http")
async def structured_request_logging(request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 2)
    span = trace.get_current_span()
    trace_id = None
    if span and span.get_span_context().is_valid:
        trace_id = format(span.get_span_context().trace_id, "032x")
    attrs = {
        "method": request.method,
        "route": request.url.path,
        "status_class": f"{response.status_code // 100}xx",
    }
    requests_total.add(1, attrs)
    request_duration_ms.record(duration_ms, attrs)
    print(json.dumps({
        "event": "ai_http_request",
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "ms": duration_ms,
        "traceId": trace_id,
    }))
    return response

app.include_router(insights.router,    prefix="/api/insights")
app.include_router(supervisor.router,  prefix="/api/supervisor")

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
