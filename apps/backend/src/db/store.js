const { randomUUID } = require('crypto');
const { transactAsTenant } = require('./tenantQuery');

async function persistOrder(order) {
  return transactAsTenant(async client => {
    await client.query(
      'INSERT INTO orders (id, total, status, created_at, tenant_id) VALUES ($1,$2,$3,$4,current_setting(\'app.current_tenant_id\'))',
      [order.id, order.total, order.status, order.createdAt]
    );
    for (const it of order.items) {
      await client.query(
        'INSERT INTO order_items (order_id, inventory_id, product_id, quantity, unit_price, line_total, tenant_id) VALUES ($1,$2,$3,$4,$5,$6,current_setting(\'app.current_tenant_id\'))',
        [order.id, it.inventoryId, it.productId, it.quantity, it.unitPrice, it.lineTotal]
      );
    }
  });
}

module.exports = {
  newId: () => randomUUID(),
  persistOrder,
};
