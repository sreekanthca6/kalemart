#!/usr/bin/env node
/**
 * Kalemart seed script — creates realistic organic store orders against the live backend.
 * Usage:  node scripts/seed-data.js [--host http://localhost:4000]
 *
 * NOTE on Shopify POS: this script only seeds local inventory.
 * When your Shopify POS store is live, real sales will arrive via
 * POST /api/shopify/webhooks/orders and reduce stock automatically.
 */

const BASE = process.argv.includes('--host')
  ? process.argv[process.argv.indexOf('--host') + 1]
  : 'http://localhost:4000';
const EMAIL = process.argv.includes('--email')
  ? process.argv[process.argv.indexOf('--email') + 1]
  : 'demo@kalemart.local';
const PASSWORD = process.argv.includes('--password')
  ? process.argv[process.argv.indexOf('--password') + 1]
  : 'kalemart-demo';

let token = '';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function checkHealth() {
  const res = await fetch(`${BASE}/health`);
  if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
    const h = await res.json();
    console.log(`✓  Backend healthy — env: ${h.env}`);
    return;
  }
  const root = await fetch(`${BASE}/`);
  if (!root.ok) throw new Error(`health → ${root.status}`);
  console.log('✓  Frontend proxy reachable');
}

async function login() {
  for (const prefix of ['/auth', '/api/auth']) {
    const res = await fetch(`${BASE}${prefix}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 120) }; }
    if (res.ok && data.token) {
      token = data.token;
      console.log(`✓  Logged in as ${EMAIL} — tenant: ${data.tenantId}`);
      return;
    }
  }
  throw new Error(`login failed for ${EMAIL}`);
}

async function printInventorySummary() {
  const items = await req('GET', '/api/inventory');
  const low   = items.filter(i => i.quantity > 0 && i.quantity < i.minQuantity);
  const out   = items.filter(i => i.quantity === 0);
  console.log(`\n📦 Inventory: ${items.length} SKUs  |  ⚠️  Low: ${low.length}  |  🔴 Out: ${out.length}`);
  if (out.length) {
    console.log('   Out of stock:');
    out.forEach(i => console.log(`   - ${i.product?.name ?? i.productId}`));
  }
  if (low.length) {
    console.log('   Low stock:');
    low.forEach(i => console.log(`   - ${i.product?.name ?? i.productId} (${i.quantity}/${i.minQuantity})`));
  }
  return items;
}

async function seedOrders(inventoryItems) {
  // Build a map of productId → inventoryId for quick lookup
  const byProduct = Object.fromEntries(inventoryItems.map(i => [i.productId, i.id]));

  // Simulate a typical morning at Kalemart organic store
  const sales = [
    // Customer 1 — commuter buying breakfast
    [{ inventoryId: byProduct['prod_001'], quantity: 1 },   // OJ
     { inventoryId: byProduct['prod_006'], quantity: 2 }],  // Nakd bars
    // Customer 2 — health-conscious shopper
    [{ inventoryId: byProduct['prod_002'], quantity: 2 },   // Oat milk
     { inventoryId: byProduct['prod_010'], quantity: 1 },   // Whole milk
     { inventoryId: byProduct['prod_007'], quantity: 1 }],  // Granola
    // Customer 3 — lunchtime shop
    [{ inventoryId: byProduct['prod_003'], quantity: 1 },   // Kombucha
     { inventoryId: byProduct['prod_008'], quantity: 1 },   // Almond butter
     { inventoryId: byProduct['prod_014'], quantity: 1 }],  // Baby spinach
    // Customer 4 — household top-up
    [{ inventoryId: byProduct['prod_017'], quantity: 1 },   // Shampoo
     { inventoryId: byProduct['prod_018'], quantity: 1 }],  // Cleaner
    // Customer 5 — wellness
    [{ inventoryId: byProduct['prod_016'], quantity: 1 },   // Probiotics
     { inventoryId: byProduct['prod_004'], quantity: 1 }],  // Ginger tea
  ];

  console.log(`\n🧾 Creating ${sales.length} seed orders…`);
  for (const [i, items] of sales.entries()) {
    // Filter out any items that are out of stock
    const available = items.filter(({ inventoryId }) => {
      const inv = inventoryItems.find(x => x.id === inventoryId);
      return inv && inv.quantity >= (items.find(it => it.inventoryId === inventoryId)?.quantity ?? 0);
    });
    if (!available.length) {
      console.log(`   Order ${i + 1}: skipped (items out of stock)`);
      continue;
    }
    try {
      const order = await req('POST', '/api/orders', { items: available });
      console.log(`   Order ${i + 1}: #${order.id.split('-')[0].toUpperCase()} — £${order.total.toFixed(2)} (${order.items.length} lines)`);
    } catch (e) {
      console.warn(`   Order ${i + 1}: failed — ${e.message}`);
    }
  }
}

async function printShopifyStatus() {
  console.log(`
🛒 Shopify POS status:
   Webhooks registered : POST /api/shopify/webhooks/products
                         POST /api/shopify/webhooks/orders
   Status              : STUBBED — awaiting Shopify POS connection
   Next step           : Set SHOPIFY_WEBHOOK_SECRET + SHOPIFY_ACCESS_TOKEN
                         in your .env, then register webhooks in Shopify admin:
                         Admin → Settings → Notifications → Webhooks`);
}

async function main() {
  console.log(`\n🌿 Kalemart Seed Script — ${BASE}\n${'─'.repeat(50)}`);
  try {
    await checkHealth();
    await login();
    const inventory = await printInventorySummary();
    await seedOrders(inventory);
    await printInventorySummary();   // show updated stock after sales
    await printShopifyStatus();
    console.log('\n✅  Seed complete.\n');
  } catch (e) {
    console.error('\n❌  Seed failed:', e.message);
    process.exit(1);
  }
}

main();
