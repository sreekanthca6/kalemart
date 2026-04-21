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

// Register observable callbacks
function registerInventoryObservables(store) {
  inventoryProductsTotal.addCallback(result => {
    result.observe(store.inventory.size);
  });

  inventoryLowStockTotal.addCallback(result => {
    let count = 0;
    for (const item of store.inventory.values()) {
      if (item.quantity > 0 && item.quantity < item.minQuantity) count++;
    }
    result.observe(count);
  });

  inventoryOutOfStockTotal.addCallback(result => {
    let count = 0;
    for (const item of store.inventory.values()) {
      if (item.quantity === 0) count++;
    }
    result.observe(count);
  });
}

module.exports = {
  registerInventoryObservables,
  inventoryUpdatesTotal,
  ordersTotal,
  orderValueTotal,
};
