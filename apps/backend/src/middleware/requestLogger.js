const { trace } = require('@opentelemetry/api');

module.exports = function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const traceId = trace.getActiveSpan()?.spanContext().traceId || '-';
    console.log(JSON.stringify({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms,
      traceId,
    }));
  });
  next();
};
