const { metrics } = require('@opentelemetry/api');

const meter = metrics.getMeter('kalemart-backend', '0.0.1');

const inventoryProductsTotal = meter.createObservableGauge('kalemart_inventory_products_total', {
  description: 'Total number of distinct products in inventory',
});

const inventoryLowStockTotal = meter.createObservableGauge('kalemart_inventory_low_stock_total', {
  description: 'Number of products below minimum quantity threshold',
});

const inventoryOutOfStockTotal = meter.createObservableGauge('kalemart_inventory_out_of_stock_total', {
  description: 'Number of products with zero stock',
});

const inventoryUpdatesTotal = meter.createCounter('kalemart_inventory_updates_total', {
  description: 'Total number of inventory quantity updates',
});

const httpRequestsTotal = meter.createCounter('kalemart_http_requests_total', {
  description: 'HTTP requests by method, route, and status class',
});

const httpRequestDurationMs = meter.createHistogram('kalemart_http_request_duration_ms', {
  description: 'HTTP request duration in milliseconds',
  unit: 'ms',
});

const httpErrorsTotal = meter.createCounter('kalemart_http_errors_total', {
  description: 'HTTP responses with status >= 500',
});

const authFailuresTotal = meter.createCounter('kalemart_auth_failures_total', {
  description: 'Failed or missing authentication attempts',
});

const ordersTotal = meter.createCounter('kalemart_orders_total', {
  description: 'Total orders created',
  unit: 'orders',
});

const orderValueTotal = meter.createCounter('kalemart_order_value_total', {
  description: 'Total order value processed',
  unit: 'CAD',
});

const purchaseOrdersTotal = meter.createCounter('kalemart_purchase_orders_total', {
  description: 'Purchase orders generated from the restock workflow',
});

const supervisorRecommendationsTotal = meter.createCounter('kalemart_supervisor_recommendations_total', {
  description: 'Supervisor recommendations generated',
});

function registerInventoryObservables(pool) {
  inventoryProductsTotal.addCallback(async result => {
    try {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM inventory');
      result.observe(rows[0].n);
    } catch { result.observe(0); }
  });

  inventoryLowStockTotal.addCallback(async result => {
    try {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM inventory WHERE quantity > 0 AND quantity < min_quantity');
      result.observe(rows[0].n);
    } catch { result.observe(0); }
  });

  inventoryOutOfStockTotal.addCallback(async result => {
    try {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM inventory WHERE quantity = 0');
      result.observe(rows[0].n);
    } catch { result.observe(0); }
  });
}

module.exports = {
  registerInventoryObservables,
  httpRequestsTotal,
  httpRequestDurationMs,
  httpErrorsTotal,
  authFailuresTotal,
  inventoryUpdatesTotal,
  ordersTotal,
  orderValueTotal,
  purchaseOrdersTotal,
  supervisorRecommendationsTotal,
};
