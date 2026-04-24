const jwt = require('jsonwebtoken');
const { trace } = require('@opentelemetry/api');
const config = require('../config');
const { runWithTenant } = require('../db/tenantQuery');
const { authFailuresTotal } = require('../metrics');
const { logEvent } = require('../observability/log');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    authFailuresTotal.add(1, { reason: 'missing_header' });
    logEvent('auth_failure', { reason: 'missing_header', path: req.originalUrl || req.path });
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.tenantId = payload.tenantId;
    req.userId   = payload.userId;
    const span = trace.getActiveSpan();
    span?.setAttribute('app.tenant_id', payload.tenantId);
    span?.setAttribute('app.user_id', payload.userId);
    runWithTenant(payload.tenantId, next);
  } catch {
    authFailuresTotal.add(1, { reason: 'invalid_token' });
    logEvent('auth_failure', { reason: 'invalid_token', path: req.originalUrl || req.path });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
