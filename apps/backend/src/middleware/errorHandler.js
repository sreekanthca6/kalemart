const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { logEvent } = require('../observability/log');

module.exports = function errorHandler(err, req, res, next) {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  }

  const status = err.status || err.statusCode || 500;
  logEvent('http_error', {
    method: req.method,
    path: req.originalUrl || req.path,
    status,
    error: err.message,
    tenantId: req.tenantId,
    userId: req.userId,
  });
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
