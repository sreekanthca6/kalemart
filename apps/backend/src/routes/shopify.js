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

// Webhook: product created or updated → upsert product record
router.post('/webhooks/products', shopifyAuth, (req, res, next) => {
  tracer.startActiveSpan('shopify.webhook.product', span => {
    try {
      const product = productSvc.upsertFromShopify(req.body);
      span.setAttribute('shopify.product_id', String(req.body.id));
      res.status(200).json({ synced: product.id });
    } catch (e) { next(e); }
    finally { span.end(); }
  });
});

// Webhook: order created → reduce inventory
router.post('/webhooks/orders', shopifyAuth, (req, res, next) => {
  tracer.startActiveSpan('shopify.webhook.order', span => {
    try {
      const lineItems = req.body.line_items || [];
      const updates = [];
      for (const item of lineItems) {
        // Match by SKU to find inventory record
        const product = [...require('../db/store').products.values()]
          .find(p => p.sku === item.sku);
        if (!product) continue;
        const invItem = [...require('../db/store').inventory.values()]
          .find(i => i.productId === product.id);
        if (!invItem) continue;
        updates.push(inventorySvc.updateQuantity(invItem.id, -item.quantity, 'shopify-sale'));
      }
      span.setAttribute('shopify.order_id', String(req.body.id));
      span.setAttribute('shopify.lines_processed', updates.length);
      res.status(200).json({ processed: updates.length });
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
