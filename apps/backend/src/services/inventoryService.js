const { trace, SpanStatusCode } = require('@opentelemetry/api');
const store = require('../db/store');
const { inventoryUpdatesTotal } = require('../metrics');

const tracer = trace.getTracer('kalemart-backend');

function list() {
  return tracer.startActiveSpan('inventory.list', span => {
    try {
      const items = [...store.inventory.values()].map(item => ({
        ...item,
        product: store.products.get(item.productId) || null,
      }));
      span.setAttribute('inventory.count', items.length);
      return items;
    } finally {
      span.end();
    }
  });
}

function getLowStock() {
  return tracer.startActiveSpan('inventory.getLowStock', span => {
    try {
      const items = [...store.inventory.values()]
        .filter(i => i.quantity < i.minQuantity)
        .map(i => ({ ...i, product: store.products.get(i.productId) || null }));
      span.setAttribute('inventory.low_stock_count', items.length);
      return items;
    } finally {
      span.end();
    }
  });
}

function getById(id) {
  return tracer.startActiveSpan('inventory.getById', span => {
    span.setAttribute('inventory.id', id);
    try {
      const item = store.inventory.get(id);
      if (!item) {
        const err = new Error(`Inventory item ${id} not found`);
        err.status = 404;
        throw err;
      }
      return { ...item, product: store.products.get(item.productId) || null };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

function updateQuantity(id, delta, reason = 'manual') {
  return tracer.startActiveSpan('inventory.updateQuantity', span => {
    span.setAttributes({ 'inventory.id': id, 'inventory.delta': delta, 'inventory.reason': reason });
    try {
      const item = store.inventory.get(id);
      if (!item) {
        const err = new Error(`Inventory item ${id} not found`);
        err.status = 404;
        throw err;
      }
      const prev = item.quantity;
      item.quantity = Math.max(0, item.quantity + delta);
      item.updatedAt = new Date();
      inventoryUpdatesTotal.add(1, { reason });
      span.setAttribute('inventory.quantity_before', prev);
      span.setAttribute('inventory.quantity_after', item.quantity);
      return { ...item, product: store.products.get(item.productId) || null };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

function create(productId, quantity, minQuantity, location) {
  return tracer.startActiveSpan('inventory.create', span => {
    span.setAttribute('inventory.productId', productId);
    try {
      if (!store.products.has(productId)) {
        const err = new Error(`Product ${productId} not found`);
        err.status = 404;
        throw err;
      }
      const id = `inv_${store.newId().split('-')[0]}`;
      const item = { id, productId, quantity, minQuantity, location, updatedAt: new Date() };
      store.inventory.set(id, item);
      return { ...item, product: store.products.get(productId) };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

module.exports = { list, getLowStock, getById, updateQuantity, create };
