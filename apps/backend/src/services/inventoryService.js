const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { randomUUID } = require('crypto');
const { queryAsTenant } = require('../db/tenantQuery');
const { inventoryUpdatesTotal } = require('../metrics');

const tracer = trace.getTracer('kalemart-backend');

const INV_SELECT = `
  SELECT i.id, i.product_id AS "productId", i.quantity, i.min_quantity AS "minQuantity",
         i.location, i.expiry_date AS "expiryDate", i.updated_at AS "updatedAt",
         p.id AS "pId", p.name AS "pName", p.sku AS "pSku", p.category,
         p.price::float AS "pPrice", p.barcode, p.organic
  FROM inventory i
  LEFT JOIN products p ON p.id = i.product_id
`;

function mapRow(r) {
  return {
    id: r.id, productId: r.productId, quantity: r.quantity, minQuantity: r.minQuantity,
    location: r.location, expiryDate: r.expiryDate, updatedAt: r.updatedAt,
    product: r.pId ? { id: r.pId, name: r.pName, sku: r.pSku, category: r.category, price: r.pPrice, barcode: r.barcode, organic: r.organic } : null,
  };
}

async function list() {
  return tracer.startActiveSpan('inventory.list', async span => {
    try {
      const { rows } = await queryAsTenant(INV_SELECT + ' ORDER BY i.id');
      span.setAttribute('inventory.count', rows.length);
      return rows.map(mapRow);
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function getLowStock() {
  return tracer.startActiveSpan('inventory.getLowStock', async span => {
    try {
      const { rows } = await queryAsTenant(INV_SELECT + ' WHERE i.quantity < i.min_quantity ORDER BY i.id');
      span.setAttribute('inventory.low_stock_count', rows.length);
      return rows.map(mapRow);
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function getById(id) {
  return tracer.startActiveSpan('inventory.getById', async span => {
    span.setAttribute('inventory.id', id);
    try {
      const { rows } = await queryAsTenant(INV_SELECT + ' WHERE i.id = $1', [id]);
      if (!rows.length) {
        const err = new Error(`Inventory item ${id} not found`);
        err.status = 404;
        throw err;
      }
      return mapRow(rows[0]);
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function updateQuantity(id, delta, reason = 'manual') {
  return tracer.startActiveSpan('inventory.updateQuantity', async span => {
    span.setAttributes({ 'inventory.id': id, 'inventory.delta': delta, 'inventory.reason': reason });
    try {
      const { rows } = await queryAsTenant(
        `UPDATE inventory
         SET quantity = GREATEST(0, quantity + $1), updated_at = NOW()
         WHERE id = $2
         RETURNING id, product_id AS "productId", quantity, min_quantity AS "minQuantity",
                   location, expiry_date AS "expiryDate", updated_at AS "updatedAt"`,
        [delta, id]
      );
      if (!rows.length) {
        const err = new Error(`Inventory item ${id} not found`);
        err.status = 404;
        throw err;
      }
      const { rows: pRows } = await queryAsTenant(
        'SELECT id, name, sku, category, price::float, barcode, organic FROM products WHERE id = $1',
        [rows[0].productId]
      );
      inventoryUpdatesTotal.add(1, { reason });
      span.setAttribute('inventory.quantity_after', rows[0].quantity);
      return { ...rows[0], product: pRows[0] || null };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function create(productId, quantity, minQuantity, location) {
  return tracer.startActiveSpan('inventory.create', async span => {
    span.setAttribute('inventory.productId', productId);
    try {
      const { rows: pRows } = await queryAsTenant(
        'SELECT id, name, sku, category, price::float, barcode, organic FROM products WHERE id = $1',
        [productId]
      );
      if (!pRows.length) {
        const err = new Error(`Product ${productId} not found`);
        err.status = 404;
        throw err;
      }
      const id = `inv_${randomUUID().split('-')[0]}`;
      const { rows } = await queryAsTenant(
        `INSERT INTO inventory (id, product_id, quantity, min_quantity, location, updated_at, tenant_id)
         VALUES ($1, $2, $3, $4, $5, NOW(), current_setting('app.current_tenant_id'))
         RETURNING id, product_id AS "productId", quantity, min_quantity AS "minQuantity",
                   location, expiry_date AS "expiryDate", updated_at AS "updatedAt"`,
        [id, productId, quantity, minQuantity, location]
      );
      span.setAttribute('inventory.id', id);
      return { ...rows[0], product: pRows[0] };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

module.exports = { list, getLowStock, getById, updateQuantity, create };
