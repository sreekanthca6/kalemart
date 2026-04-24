const { trace } = require('@opentelemetry/api');

function logEvent(event, fields = {}) {
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId;
  console.log(JSON.stringify({
    event,
    ts: new Date().toISOString(),
    ...(traceId ? { traceId } : {}),
    ...fields,
  }));
}

module.exports = { logEvent };
