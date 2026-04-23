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

const ordersTotal = meter.createCounter('kalemart_orders_total', {
  description: 'Total orders created',
  unit: 'orders',
});

const orderValueTotal = meter.createCounter('kalemart_order_value_total', {
  description: 'Total order value processed',
  unit: 'GBP',
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
  inventoryUpdatesTotal,
  ordersTotal,
  orderValueTotal,
};
