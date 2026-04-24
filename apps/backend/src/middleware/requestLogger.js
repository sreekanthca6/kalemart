const { trace } = require('@opentelemetry/api');
const { httpRequestsTotal, httpRequestDurationMs, httpErrorsTotal } = require('../metrics');
const { logEvent } = require('../observability/log');

module.exports = function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const traceId = trace.getActiveSpan()?.spanContext().traceId || '-';
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    const attrs = {
      method: req.method,
      route: req.route?.path || req.path,
      status_class: statusClass,
    };
    httpRequestsTotal.add(1, attrs);
    httpRequestDurationMs.record(ms, attrs);
    if (res.statusCode >= 500) httpErrorsTotal.add(1, attrs);
    logEvent('http_request', {
      method: req.method,
      path: req.originalUrl || req.path,
      status: res.statusCode,
      ms,
      traceId,
      tenantId: req.tenantId,
      userId: req.userId,
    });
  });
  next();
};
