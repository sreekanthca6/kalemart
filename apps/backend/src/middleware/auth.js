const jwt = require('jsonwebtoken');
const config = require('../config');
const { runWithTenant } = require('../db/tenantQuery');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.tenantId = payload.tenantId;
    req.userId   = payload.userId;
    runWithTenant(payload.tenantId, next);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
