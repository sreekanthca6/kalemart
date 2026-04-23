const router = require('express').Router();
const crypto = require('crypto');
const { trace } = require('@opentelemetry/api');
const productSvc = require('../services/productService');
const inventorySvc = require('../services/inventoryService');
const config = require('../config');

const tracer = trace.getTracer('kalemart-backend');

function verifyHmac(req) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  if (!hmac) return false;
  const digest = crypto
    .createHmac('sha256', config.shopify.webhookSecret)
    .update(req.rawBody || '')
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

// Middleware: verify Shopify HMAC (bypassed in dev if secret is 'dev-secret')
function shopifyAuth(req, res, next) {
  if (config.shopify.webhookSecret === 'dev-secret') return next();
  if (!verifyHmac(req)) return res.status(401).json({ error: 'Invalid HMAC' });
  next();
}

const pool = require('../db/pool');

// Webhook: product created or updated → upsert product record
router.post('/webhooks/products', shopifyAuth, async (req, res, next) => {
  return tracer.startActiveSpan('shopify.webhook.product', async span => {
    try {
      const product = await productSvc.upsertFromShopify(req.body);
      span.setAttribute('shopify.product_id', String(req.body.id));
      res.status(200).json({ synced: product.id });
    } catch (e) { next(e); }
    finally { span.end(); }
  });
});

// Webhook: order created → reduce inventory
router.post('/webhooks/orders', shopifyAuth, async (req, res, next) => {
  return tracer.startActiveSpan('shopify.webhook.order', async span => {
    try {
      const lineItems = req.body.line_items || [];
      let processed = 0;
      for (const item of lineItems) {
        const { rows } = await pool.query(
          `SELECT i.id FROM inventory i
           JOIN products p ON p.id = i.product_id
           WHERE p.sku = $1 LIMIT 1`,
          [item.sku]
        );
        if (!rows.length) continue;
        await inventorySvc.updateQuantity(rows[0].id, -item.quantity, 'shopify-sale');
        processed++;
      }
      span.setAttribute('shopify.order_id', String(req.body.id));
      span.setAttribute('shopify.lines_processed', processed);
      res.status(200).json({ processed });
    } catch (e) { next(e); }
    finally { span.end(); }
  });
});

// Stub: manually trigger a Shopify product sync (dev helper)
router.post('/sync/products', (_req, res) => {
  res.json({
    message: 'Shopify product sync stub — connect SHOPIFY_ACCESS_TOKEN to enable',
    shop: config.shopify.shopDomain,
  });
});

module.exports = router;
