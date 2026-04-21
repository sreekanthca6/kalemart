const { trace, SpanStatusCode } = require('@opentelemetry/api');
const config = require('../config');

const tracer = trace.getTracer('kalemart-backend');

async function post(path, body) {
  return tracer.startActiveSpan(`aiService.${path}`, async span => {
    span.setAttribute('ai_service.path', path);
    try {
      const res = await fetch(`${config.aiServiceUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const text = await res.text();
        const err = new Error(`AI service error ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function get(path) {
  return tracer.startActiveSpan(`aiService.${path}`, async span => {
    try {
      const res = await fetch(`${config.aiServiceUrl}${path}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`AI service ${res.status}`);
      return res.json();
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

module.exports = { post, get };
