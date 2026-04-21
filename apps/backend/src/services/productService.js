const { trace, SpanStatusCode } = require('@opentelemetry/api');
const store = require('../db/store');

const tracer = trace.getTracer('kalemart-backend');

function list(category) {
  return tracer.startActiveSpan('product.list', span => {
    try {
      let items = [...store.products.values()];
      if (category) {
        items = items.filter(p => p.category === category);
        span.setAttribute('product.filter.category', category);
      }
      span.setAttribute('product.count', items.length);
      return items;
    } finally {
      span.end();
    }
  });
}

function getById(id) {
  return tracer.startActiveSpan('product.getById', span => {
    span.setAttribute('product.id', id);
    try {
      const product = store.products.get(id);
      if (!product) {
        const err = new Error(`Product ${id} not found`);
        err.status = 404;
        throw err;
      }
      return product;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

function create(data) {
  return tracer.startActiveSpan('product.create', span => {
    try {
      const id = `prod_${store.newId().split('-')[0]}`;
      const product = { id, ...data, createdAt: new Date() };
      store.products.set(id, product);
      span.setAttribute('product.id', id);
      return product;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

function upsertFromShopify(shopifyProduct) {
  return tracer.startActiveSpan('product.upsertFromShopify', span => {
    span.setAttribute('shopify.product_id', String(shopifyProduct.id));
    try {
      const variant = shopifyProduct.variants?.[0];
      const id = `prod_shopify_${shopifyProduct.id}`;
      const product = {
        id,
        name: shopifyProduct.title,
        sku: variant?.sku || '',
        category: shopifyProduct.product_type?.toLowerCase() || 'uncategorised',
        price: parseFloat(variant?.price || 0),
        barcode: variant?.barcode || '',
        shopifyId: shopifyProduct.id,
        updatedAt: new Date(),
      };
      store.products.set(id, product);
      return product;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

module.exports = { list, getById, create, upsertFromShopify };
