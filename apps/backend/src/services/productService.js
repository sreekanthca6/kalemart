const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');

const tracer = trace.getTracer('kalemart-backend');

async function list(category) {
  return tracer.startActiveSpan('product.list', async span => {
    try {
      const params = [];
      let query = 'SELECT id, name, sku, category, price::float, barcode, organic FROM products';
      if (category) {
        query += ' WHERE category = $1';
        params.push(category);
        span.setAttribute('product.filter.category', category);
      }
      query += ' ORDER BY id';
      const { rows } = await pool.query(query, params);
      span.setAttribute('product.count', rows.length);
      return rows;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function getById(id) {
  return tracer.startActiveSpan('product.getById', async span => {
    span.setAttribute('product.id', id);
    try {
      const { rows } = await pool.query(
        'SELECT id, name, sku, category, price::float, barcode, organic FROM products WHERE id = $1',
        [id]
      );
      if (!rows.length) {
        const err = new Error(`Product ${id} not found`);
        err.status = 404;
        throw err;
      }
      return rows[0];
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function create(data) {
  return tracer.startActiveSpan('product.create', async span => {
    try {
      const id = `prod_${randomUUID().split('-')[0]}`;
      const { name, sku, category, price, barcode, organic } = data;
      const { rows } = await pool.query(
        `INSERT INTO products (id, name, sku, category, price, barcode, organic)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, sku, category, price::float, barcode, organic`,
        [id, name, sku, category, price, barcode || null, organic || false]
      );
      span.setAttribute('product.id', id);
      return rows[0];
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function upsertFromShopify(shopifyProduct) {
  return tracer.startActiveSpan('product.upsertFromShopify', async span => {
    span.setAttribute('shopify.product_id', String(shopifyProduct.id));
    try {
      const variant = shopifyProduct.variants?.[0];
      const id = `prod_shopify_${shopifyProduct.id}`;
      const { rows } = await pool.query(
        `INSERT INTO products (id, name, sku, category, price, barcode)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, sku = EXCLUDED.sku,
           category = EXCLUDED.category, price = EXCLUDED.price,
           barcode = EXCLUDED.barcode
         RETURNING id, name, sku, category, price::float, barcode, organic`,
        [
          id,
          shopifyProduct.title,
          variant?.sku || '',
          shopifyProduct.product_type?.toLowerCase() || 'uncategorised',
          parseFloat(variant?.price || 0),
          variant?.barcode || '',
        ]
      );
      return rows[0];
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

module.exports = { list, getById, create, upsertFromShopify };
