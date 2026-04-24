const router = require('express').Router();
const pool = require('../db/pool');
const config = require('../config');
const { queryAsTenant } = require('../db/tenantQuery');

function bool(value) {
  return value ? 'configured' : 'missing';
}

router.get('/readiness', async (req, res, next) => {
  try {
    const started = Date.now();
    const db = await pool.query('SELECT NOW() AS now');
    const [products, inventory, orders, lowStock, outOfStock] = await Promise.all([
      queryAsTenant('SELECT COUNT(*)::int AS count FROM products'),
      queryAsTenant('SELECT COUNT(*)::int AS count FROM inventory'),
      queryAsTenant('SELECT COUNT(*)::int AS count FROM orders'),
      queryAsTenant('SELECT COUNT(*)::int AS count FROM inventory WHERE quantity > 0 AND quantity < min_quantity'),
      queryAsTenant('SELECT COUNT(*)::int AS count FROM inventory WHERE quantity = 0'),
    ]);

    res.json({
      status: 'ready',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      service: {
        name: 'kalemart-backend',
        version: process.env.APP_VERSION || '0.0.1',
        env: config.nodeEnv,
        uptimeSec: Math.round(process.uptime()),
      },
      tenant: {
        id: req.tenantId,
        products: products.rows[0].count,
        inventory: inventory.rows[0].count,
        orders: orders.rows[0].count,
        lowStock: lowStock.rows[0].count,
        outOfStock: outOfStock.rows[0].count,
      },
      database: {
        status: 'ok',
        serverTime: db.rows[0].now,
      },
      integrations: {
        otel: {
          status: bool(process.env.OTEL_EXPORTER_OTLP_ENDPOINT),
          endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || null,
          serviceName: process.env.OTEL_SERVICE_NAME || 'kalemart-backend',
        },
        aiService: {
          status: bool(config.aiServiceUrl),
          url: config.aiServiceUrl,
        },
        anthropic: {
          status: bool(config.anthropicApiKey),
        },
        shopify: {
          shopDomain: config.shopify.shopDomain,
          webhookSecret: config.shopify.webhookSecret === 'dev-secret' ? 'development-secret' : 'configured',
          accessToken: bool(config.shopify.accessToken),
        },
      },
      deployment: {
        imageTag: process.env.APP_VERSION || '0.0.1',
        node: process.version,
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
