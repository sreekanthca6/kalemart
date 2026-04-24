#!/usr/bin/env node
/**
 * KaleMart24 — Shopify CSV Import
 *
 * Imports real sales data exported from Shopify admin.
 * Replaces synthetic order data for imported date ranges.
 *
 * How to get the data from Sam:
 *   Shopify Admin → Analytics → Reports → Sales by product
 *   Export → CSV (choose date range Nov 2025 → today)
 *
 * Alternatively export Orders:
 *   Shopify Admin → Orders → Export → CSV (all orders)
 *
 * Usage:
 *   node scripts/import-shopify-csv.js orders.csv [--dry-run]
 *
 * Expected CSV columns (Shopify default orders export):
 *   Name, Email, Financial Status, Paid at, Fulfillment Status, Fulfilled at,
 *   Currency, Subtotal, Shipping, Taxes, Total, Discount Code, Discount Amount,
 *   Lineitem quantity, Lineitem name, Lineitem price, Lineitem sku, ...
 */

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const DRY_RUN = process.argv.includes('--dry-run');
const csvFile = process.argv.find(a => a.endsWith('.csv'));

if (!csvFile) {
  console.error('Usage: node scripts/import-shopify-csv.js <orders.csv> [--dry-run]');
  process.exit(1);
}

const pool = new Pool({
  host:     process.env.PGHOST     || 'localhost',
  port:     parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'kalemart',
  user:     process.env.PGUSER     || 'kalemart',
  password: process.env.PGPASSWORD || 'kalemart_secret_2024',
});

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').replace(/^"|"$/g, '').trim();
    });
    return obj;
  });
}

async function importOrders(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);

  // Group line items by order name
  const orderMap = new Map();
  for (const row of rows) {
    const name = row['Name'] || row['Order'];
    if (!name) continue;
    if (!orderMap.has(name)) {
      orderMap.set(name, {
        shopifyId: name,
        total:    parseFloat(row['Total'] || row['Subtotal'] || '0'),
        status:   (row['Financial Status'] || 'completed').toLowerCase(),
        createdAt: new Date(row['Paid at'] || row['Created at'] || Date.now()),
        items: [],
      });
    }
    const qty   = parseInt(row['Lineitem quantity'] || '1');
    const price = parseFloat(row['Lineitem price'] || '0');
    const sku   = row['Lineitem sku'] || '';
    const name2 = row['Lineitem name'] || '';
    if (name2 || sku) {
      orderMap.get(name).items.push({ sku, name: name2, quantity: qty, unitPrice: price, lineTotal: +(qty * price).toFixed(2) });
    }
  }

  console.log(`Parsed ${orderMap.size} orders from ${csvPath}`);
  if (DRY_RUN) {
    console.log('DRY RUN — no changes written');
    for (const [id, o] of [...orderMap].slice(0, 3)) {
      console.log(`  ${id}: $${o.total} (${o.items.length} items) @ ${o.createdAt.toISOString().slice(0,10)}`);
    }
    return;
  }

  // Load product SKU → id map
  const { rows: products } = await pool.query('SELECT id, sku FROM products');
  const skuToId = new Map(products.map(p => [p.sku, p.id]));

  // Load inventory productId → inventoryId map
  const { rows: inv } = await pool.query('SELECT id, product_id FROM inventory');
  const prodToInvId = new Map(inv.map(i => [i.product_id, i.id]));

  const client = await pool.connect();
  let imported = 0, skipped = 0;

  try {
    await client.query('BEGIN');

    for (const [, order] of orderMap) {
      // Check for duplicate
      const { rows: existing } = await client.query(
        "SELECT id FROM orders WHERE id = $1 OR id::text LIKE $2 LIMIT 1",
        [order.shopifyId, `%${order.shopifyId}%`]
      );
      if (existing.length > 0) { skipped++; continue; }

      const orderId = randomUUID();
      await client.query(
        'INSERT INTO orders (id, total, status, created_at) VALUES ($1,$2,$3,$4)',
        [orderId, order.total, order.status, order.createdAt]
      );

      for (const item of order.items) {
        const productId  = skuToId.get(item.sku) || null;
        const inventoryId = productId ? prodToInvId.get(productId) : null;
        await client.query(
          `INSERT INTO order_items (order_id, inventory_id, product_id, quantity, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [orderId, inventoryId, productId, item.quantity, item.unitPrice, item.lineTotal]
        );
      }
      imported++;
    }

    await client.query('COMMIT');
    console.log(`✅ Imported: ${imported} orders, skipped ${skipped} duplicates`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

importOrders(csvFile).catch(err => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
