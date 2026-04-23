const { randomUUID } = require('crypto');
const pool = require('./pool');

async function persistInventoryUpdate(id, quantity) {
  await pool.query(
    'UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE id = $2',
    [quantity, id]
  );
}

async function persistOrder(order) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO orders (id, total, status, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, order.total, order.status, order.createdAt]
    );
    for (const it of order.items) {
      await client.query(
        'INSERT INTO order_items (order_id, inventory_id, product_id, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5,$6)',
        [order.id, it.inventoryId, it.productId, it.quantity, it.unitPrice, it.lineTotal]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  newId: () => randomUUID(),
  persistInventoryUpdate,
  persistOrder,
};
