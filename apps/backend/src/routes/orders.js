const router = require('express').Router();
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const store = require('../db/store');
const inventorySvc = require('../services/inventoryService');
const { ordersTotal, orderValueTotal } = require('../metrics');

const tracer = trace.getTracer('kalemart-backend');

router.get('/', (_req, res) => {
  res.json([...store.orders.values()]);
});

router.get('/:id', (req, res, next) => {
  const order = store.orders.get(req.params.id);
  if (!order) { const e = new Error('Order not found'); e.status = 404; return next(e); }
  res.json(order);
});

// Create order — deducts inventory for each line item
router.post('/', async (req, res, next) => {
  const span = tracer.startSpan('order.create');
  try {
    const { items } = req.body; // [{ inventoryId, quantity }]
    if (!items?.length) {
      const e = new Error('items[] is required'); e.status = 400; throw e;
    }

    let total = 0;
    const lineItems = [];

    for (const { inventoryId, quantity } of items) {
      const updated = inventorySvc.updateQuantity(inventoryId, -quantity, 'sale');
      const product = store.products.get(updated.productId);
      const lineTotal = (product?.price || 0) * quantity;
      total += lineTotal;
      lineItems.push({ inventoryId, productId: updated.productId, quantity, unitPrice: product?.price, lineTotal });
    }

    const id = store.newId();
    const order = { id, items: lineItems, total: parseFloat(total.toFixed(2)), status: 'completed', createdAt: new Date() };
    store.orders.set(id, order);

    ordersTotal.add(1);
    orderValueTotal.add(total);
    span.setAttribute('order.id', id);
    span.setAttribute('order.total', total);

    res.status(201).json(order);
  } catch (e) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
    next(e);
  } finally {
    span.end();
  }
});

module.exports = router;
