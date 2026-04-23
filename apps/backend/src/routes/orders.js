const router = require('express').Router();
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { queryAsTenant } = require('../db/tenantQuery');
const { newId, persistOrder } = require('../db/store');
const inventorySvc = require('../services/inventoryService');
const { ordersTotal, orderValueTotal } = require('../metrics');

const tracer = trace.getTracer('kalemart-backend');

router.get('/', async (req, res, next) => {
  try {
    const { rows: orderRows } = await queryAsTenant(
      'SELECT id, total::float, status, created_at AS "createdAt" FROM orders ORDER BY created_at DESC LIMIT 1000'
    );
    if (!orderRows.length) return res.json([]);
    const { rows: itemRows } = await queryAsTenant(
      `SELECT order_id AS "orderId", inventory_id AS "inventoryId", product_id AS "productId",
              quantity, unit_price::float AS "unitPrice", line_total::float AS "lineTotal"
       FROM order_items WHERE order_id = ANY($1)`,
      [orderRows.map(o => o.id)]
    );
    const itemsByOrder = new Map();
    for (const it of itemRows) {
      if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, []);
      itemsByOrder.get(it.orderId).push(it);
    }
    res.json(orderRows.map(o => ({ ...o, items: itemsByOrder.get(o.id) || [] })));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await queryAsTenant(
      'SELECT id, total::float, status, created_at AS "createdAt" FROM orders WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) { const e = new Error('Order not found'); e.status = 404; return next(e); }
    const { rows: items } = await queryAsTenant(
      `SELECT inventory_id AS "inventoryId", product_id AS "productId",
              quantity, unit_price::float AS "unitPrice", line_total::float AS "lineTotal"
       FROM order_items WHERE order_id = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], items });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  const span = tracer.startSpan('order.create');
  try {
    const { items } = req.body;
    if (!items?.length) {
      const e = new Error('items[] is required'); e.status = 400; throw e;
    }
    let total = 0;
    const lineItems = [];
    for (const { inventoryId, quantity } of items) {
      const updated = await inventorySvc.updateQuantity(inventoryId, -quantity, 'sale');
      const lineTotal = (updated.product?.price || 0) * quantity;
      total += lineTotal;
      lineItems.push({ inventoryId, productId: updated.productId, quantity, unitPrice: updated.product?.price, lineTotal });
    }
    const id = newId();
    const order = { id, items: lineItems, total: parseFloat(total.toFixed(2)), status: 'completed', createdAt: new Date() };
    await persistOrder(order);
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
