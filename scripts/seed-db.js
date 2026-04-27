#!/usr/bin/env node
/**
 * KaleMart24 — Database Seed Script
 * Populates PostgreSQL with the product catalog, initial inventory,
 * and 6 months of synthetic sales data (Nov 1 2025 – Apr 21 2026).
 *
 * Revenue model: $106,458.33/month target, 45.36% gross margin
 * Run: node scripts/seed-db.js
 */

const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const pool = new Pool({
  host:     process.env.PGHOST     || 'localhost',
  port:     parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'kalemart',
  user:     process.env.PGUSER     || 'kalemart',
  password: process.env.PGPASSWORD,
});

const DEFAULT_TENANT_ID = process.env.SEED_TENANT_ID || 'tenant_default';
const DEFAULT_STORE_NAME = process.env.SEED_STORE_NAME || 'KaleMart24';
const DEFAULT_USER_ID = process.env.SEED_USER_ID || 'user_demo_default';
const DEFAULT_USER_EMAIL = process.env.SEED_USER_EMAIL || 'demo@kalemart.local';
// Password: kalemart-demo
const DEFAULT_PASSWORD_HASH = process.env.SEED_PASSWORD_HASH || '$2b$12$gU3jjGArzFhnHv.BWQGrxetEvOmkaMJh0TZ2ofSin4xdoaewaJ9I.';

// ── Product Catalog ───────────────────────────────────────────────────────────
// Based on KaleMart24 menu (organic convenience near Bell Centre, Montréal)

const PRODUCTS = [
  // Beverages
  { id: 'prod_001', name: 'Toro Matcha Energy Drink 355ml',        sku: 'BEV-TORO-355',  category: 'beverages',     price: 4.99,  barcode: '0627843520010', organic: true,  cost: 2.20 },
  { id: 'prod_002', name: 'Rise Kombucha Ginger Lemon 355ml',       sku: 'BEV-RISE-355',  category: 'beverages',     price: 4.49,  barcode: '0627843400018', organic: true,  cost: 1.95 },
  { id: 'prod_003', name: 'Guru Organic Energy Drink 250ml',        sku: 'BEV-GURU-250',  category: 'beverages',     price: 3.49,  barcode: '0627843100010', organic: true,  cost: 1.40 },
  { id: 'prod_004', name: 'Harmless Harvest Coconut Water 330ml',   sku: 'BEV-HHRV-330',  category: 'beverages',     price: 5.99,  barcode: '0855411003070', organic: true,  cost: 2.75 },
  { id: 'prod_005', name: 'Oatly Barista Oat Drink 1L',             sku: 'BEV-OATB-1L',   category: 'beverages',     price: 5.49,  barcode: '7394376616304', organic: false, cost: 2.50 },
  { id: 'prod_006', name: 'Évive Açaí Berry Smoothie Cubes 315g',   sku: 'BEV-EVIV-315',  category: 'beverages',     price: 8.99,  barcode: '0627843600015', organic: true,  cost: 4.20 },
  { id: 'prod_026', name: 'Biosteel Sports Hydration Mix 315ml',    sku: 'BEV-BIOS-315',  category: 'beverages',     price: 3.99,  barcode: '0629908001003', organic: false, cost: 1.80 },
  { id: 'prod_027', name: 'Cawston Press Sparkling Rhubarb 330ml',  sku: 'BEV-CAWS-330',  category: 'beverages',     price: 3.49,  barcode: '5034984300012', organic: true,  cost: 1.50 },
  // Grab & Go meals
  { id: 'prod_007', name: 'KM24 Quinoa Power Bowl 350g',            sku: 'GNG-QPWB-350',  category: 'grab-n-go',     price: 11.99, barcode: '0627843700010', organic: true,  cost: 5.20 },
  { id: 'prod_008', name: 'KM24 Avocado Veggie Wrap',               sku: 'GNG-AVWR-1',    category: 'grab-n-go',     price: 9.99,  barcode: '0627843700027', organic: true,  cost: 4.30 },
  { id: 'prod_009', name: 'KM24 Overnight Oats Vanilla Chia 300g', sku: 'GNG-OATV-300',  category: 'grab-n-go',     price: 7.49,  barcode: '0627843700034', organic: true,  cost: 3.10 },
  { id: 'prod_028', name: 'KM24 Green Goddess Salad 300g',          sku: 'GNG-GGSD-300',  category: 'grab-n-go',     price: 10.99, barcode: '0627843700041', organic: true,  cost: 4.80 },
  { id: 'prod_029', name: 'KM24 Açaí Superfood Bowl 350g',          sku: 'GNG-ACAI-350',  category: 'grab-n-go',     price: 12.99, barcode: '0627843700058', organic: true,  cost: 5.60 },
  // Coffee & Matcha
  { id: 'prod_010', name: 'Four Sigmatic Matcha Latte Mix 10pk',    sku: 'MTH-FSIG-10',   category: 'hot-drinks',    price: 19.99, barcode: '0816897020256', organic: true,  cost: 9.50 },
  { id: 'prod_011', name: 'Toro Matcha Ceremonial Grade 30g',       sku: 'MTH-TORC-30',   category: 'hot-drinks',    price: 22.99, barcode: '0627843520027', organic: true,  cost: 11.00 },
  { id: 'prod_012', name: 'Pukka Three Mint Tea 20 bags',           sku: 'TEA-PUKM-20',   category: 'hot-drinks',    price: 6.99,  barcode: '5060229011824', organic: true,  cost: 3.10 },
  { id: 'prod_030', name: 'Pukka Turmeric Gold Tea 20 bags',        sku: 'TEA-PUKT-20',   category: 'hot-drinks',    price: 7.49,  barcode: '5060229011831', organic: true,  cost: 3.30 },
  // Snacks
  { id: 'prod_013', name: 'Made Good Chocolate Chip Granola Bar',   sku: 'SNK-MGCG-1',    category: 'snacks',        price: 2.49,  barcode: '0627843800012', organic: true,  cost: 0.95 },
  { id: 'prod_014', name: 'Genuine Health Fermented Protein Bar',   sku: 'SNK-GHFP-1',    category: 'snacks',        price: 3.99,  barcode: '0620365001082', organic: false, cost: 1.70 },
  { id: 'prod_015', name: "Nuts to You Almond Butter 250g",         sku: 'SNK-NTYA-250',  category: 'snacks',        price: 8.49,  barcode: '0620365002010', organic: false, cost: 4.10 },
  { id: 'prod_016', name: "Mary's Gone Crackers Original 156g",     sku: 'SNK-MRGC-156',  category: 'snacks',        price: 6.99,  barcode: '0703565018019', organic: true,  cost: 3.20 },
  { id: 'prod_031', name: 'Hippie Snacks Avocado Crisps 35g',       sku: 'SNK-HIPP-35',   category: 'snacks',        price: 3.49,  barcode: '0627843801010', organic: false, cost: 1.40 },
  { id: 'prod_032', name: 'Way Better Snacks Sweet Potato Chips',   sku: 'SNK-WBSS-142',  category: 'snacks',        price: 4.99,  barcode: '0700156001100', organic: false, cost: 2.10 },
  { id: 'prod_033', name: 'Kite Hill Almond Cream Cheese 227g',     sku: 'SNK-KITE-227',  category: 'snacks',        price: 7.99,  barcode: '0858001002046', organic: false, cost: 3.80 },
  // Chilled
  { id: 'prod_017', name: 'Liberté Kefir Nature 2% 750ml',          sku: 'CHI-LIBK-750',  category: 'chilled',       price: 5.99,  barcode: '0057900000017', organic: false, cost: 2.60 },
  { id: 'prod_018', name: 'Maison Riviera Yogourt Grec 500g',       sku: 'CHI-MRYO-500',  category: 'chilled',       price: 6.49,  barcode: '0057900100018', organic: false, cost: 2.90 },
  { id: 'prod_019', name: 'Organic Meadow Whole Milk 1L',           sku: 'CHI-OMWM-1L',   category: 'chilled',       price: 4.29,  barcode: '0057900200019', organic: true,  cost: 1.80 },
  { id: 'prod_034', name: 'Greenhouse Cold Pressed Green Juice 355ml', sku: 'CHI-GRNH-355', category: 'chilled',    price: 6.99,  barcode: '0628604000043', organic: true,  cost: 3.10 },
  { id: 'prod_035', name: 'Suja Organic Mighty Greens 325ml',       sku: 'CHI-SUJA-325',  category: 'chilled',       price: 5.99,  barcode: '0855350002009', organic: true,  cost: 2.65 },
  // Fresh
  { id: 'prod_020', name: 'Organic Avocados x2',                    sku: 'FRS-AVOC-2',    category: 'fresh',         price: 3.99,  barcode: '0627843900010', organic: true,  cost: 1.80 },
  { id: 'prod_021', name: 'Organic Baby Spinach 142g',              sku: 'FRS-SPIN-142',  category: 'fresh',         price: 4.49,  barcode: '0627843900027', organic: true,  cost: 2.00 },
  { id: 'prod_036', name: 'Organic Banana x3',                      sku: 'FRS-BANA-3',    category: 'fresh',         price: 1.99,  barcode: '0627843900034', organic: true,  cost: 0.80 },
  { id: 'prod_037', name: 'Medjool Dates 250g',                     sku: 'FRS-DATE-250',  category: 'fresh',         price: 5.49,  barcode: '0627843900041', organic: true,  cost: 2.40 },
  // Health & Wellness
  { id: 'prod_022', name: 'Garden of Life Probiotic 30 caps',       sku: 'HLT-GOLP-30',   category: 'health',        price: 24.99, barcode: '0658010114467', organic: true,  cost: 11.50 },
  { id: 'prod_023', name: 'Genuine Health Greens+ O Superfood 8g',  sku: 'HLT-GHGP-8',    category: 'health',        price: 3.49,  barcode: '0620365003000', organic: true,  cost: 1.40 },
  { id: 'prod_038', name: 'Vega One All-In-One Shake 43g',          sku: 'HLT-VEGA-43',   category: 'health',        price: 4.99,  barcode: '0838766002506', organic: false, cost: 2.20 },
  { id: 'prod_039', name: 'Now Foods Vitamin D3 2000IU 120 caps',   sku: 'HLT-NOWD-120',  category: 'health',        price: 14.99, barcode: '0733739003614', organic: false, cost: 6.50 },
  // Personal Care
  { id: 'prod_024', name: 'Attitude Natural Shampoo 473ml',         sku: 'PCR-ATTS-473',  category: 'personal-care', price: 12.99, barcode: '0627843000019', organic: true,  cost: 5.80 },
  { id: 'prod_025', name: "Burt's Bees Lip Balm Original",          sku: 'PCR-BBIP-1',    category: 'personal-care', price: 4.99,  barcode: '0792850001014', organic: false, cost: 1.80 },
  { id: 'prod_040', name: 'Schmidt\'s Deodorant Lavender & Sage',   sku: 'PCR-SCHD-75',   category: 'personal-care', price: 10.99, barcode: '0853664006024', organic: false, cost: 4.80 },
];

// ── Inventory (current state as of Apr 21, 2026) ──────────────────────────────

function daysFromNow(n) {
  const d = new Date('2026-04-21'); d.setDate(d.getDate() + n); d.setHours(23, 59, 0, 0); return d;
}

const INVENTORY = [
  // Beverages
  { id: 'inv_001', productId: 'prod_001', quantity: 0,  minQuantity: 24, location: 'fridge-1' },
  { id: 'inv_002', productId: 'prod_002', quantity: 5,  minQuantity: 18, location: 'fridge-1' },
  { id: 'inv_003', productId: 'prod_003', quantity: 0,  minQuantity: 24, location: 'fridge-1' },
  { id: 'inv_004', productId: 'prod_004', quantity: 12, minQuantity: 12, location: 'fridge-2' },
  { id: 'inv_005', productId: 'prod_005', quantity: 8,  minQuantity: 12, location: 'fridge-2' },
  { id: 'inv_006', productId: 'prod_006', quantity: 10, minQuantity: 8,  location: 'freezer-1' },
  { id: 'inv_026', productId: 'prod_026', quantity: 18, minQuantity: 12, location: 'fridge-1' },
  { id: 'inv_027', productId: 'prod_027', quantity: 14, minQuantity: 12, location: 'fridge-2' },
  // Grab & Go
  { id: 'inv_007', productId: 'prod_007', quantity: 4,  minQuantity: 8,  location: 'grab-n-go', expiryDate: daysFromNow(4) },
  { id: 'inv_008', productId: 'prod_008', quantity: 6,  minQuantity: 8,  location: 'grab-n-go', expiryDate: daysFromNow(-1) },
  { id: 'inv_009', productId: 'prod_009', quantity: 12, minQuantity: 6,  location: 'grab-n-go', expiryDate: daysFromNow(6) },
  { id: 'inv_028', productId: 'prod_028', quantity: 5,  minQuantity: 6,  location: 'grab-n-go', expiryDate: daysFromNow(3) },
  { id: 'inv_029', productId: 'prod_029', quantity: 7,  minQuantity: 6,  location: 'grab-n-go', expiryDate: daysFromNow(5) },
  // Hot drinks
  { id: 'inv_010', productId: 'prod_010', quantity: 8,  minQuantity: 6,  location: 'aisle-1' },
  { id: 'inv_011', productId: 'prod_011', quantity: 3,  minQuantity: 6,  location: 'counter' },
  { id: 'inv_012', productId: 'prod_012', quantity: 10, minQuantity: 5,  location: 'aisle-1' },
  { id: 'inv_030', productId: 'prod_030', quantity: 7,  minQuantity: 5,  location: 'aisle-1' },
  // Snacks
  { id: 'inv_013', productId: 'prod_013', quantity: 24, minQuantity: 12, location: 'aisle-2' },
  { id: 'inv_014', productId: 'prod_014', quantity: 8,  minQuantity: 8,  location: 'aisle-2' },
  { id: 'inv_015', productId: 'prod_015', quantity: 6,  minQuantity: 6,  location: 'aisle-2' },
  { id: 'inv_016', productId: 'prod_016', quantity: 9,  minQuantity: 6,  location: 'aisle-2' },
  { id: 'inv_031', productId: 'prod_031', quantity: 20, minQuantity: 12, location: 'aisle-2' },
  { id: 'inv_032', productId: 'prod_032', quantity: 15, minQuantity: 12, location: 'aisle-2' },
  { id: 'inv_033', productId: 'prod_033', quantity: 6,  minQuantity: 6,  location: 'fridge-3' },
  // Chilled
  { id: 'inv_017', productId: 'prod_017', quantity: 5,  minQuantity: 8,  location: 'fridge-3', expiryDate: daysFromNow(2) },
  { id: 'inv_018', productId: 'prod_018', quantity: 12, minQuantity: 6,  location: 'fridge-3', expiryDate: daysFromNow(12) },
  { id: 'inv_019', productId: 'prod_019', quantity: 10, minQuantity: 6,  location: 'fridge-3', expiryDate: daysFromNow(7) },
  { id: 'inv_034', productId: 'prod_034', quantity: 8,  minQuantity: 6,  location: 'fridge-3', expiryDate: daysFromNow(5) },
  { id: 'inv_035', productId: 'prod_035', quantity: 6,  minQuantity: 6,  location: 'fridge-3', expiryDate: daysFromNow(4) },
  // Fresh
  { id: 'inv_020', productId: 'prod_020', quantity: 0,  minQuantity: 6,  location: 'fresh-rack' },
  { id: 'inv_021', productId: 'prod_021', quantity: 6,  minQuantity: 4,  location: 'fresh-rack', expiryDate: daysFromNow(3) },
  { id: 'inv_036', productId: 'prod_036', quantity: 12, minQuantity: 6,  location: 'fresh-rack', expiryDate: daysFromNow(4) },
  { id: 'inv_037', productId: 'prod_037', quantity: 8,  minQuantity: 4,  location: 'fresh-rack' },
  // Health
  { id: 'inv_022', productId: 'prod_022', quantity: 4,  minQuantity: 4,  location: 'aisle-3' },
  { id: 'inv_023', productId: 'prod_023', quantity: 18, minQuantity: 6,  location: 'aisle-3' },
  { id: 'inv_038', productId: 'prod_038', quantity: 12, minQuantity: 6,  location: 'aisle-3' },
  { id: 'inv_039', productId: 'prod_039', quantity: 8,  minQuantity: 4,  location: 'aisle-3' },
  // Personal care
  { id: 'inv_024', productId: 'prod_024', quantity: 3,  minQuantity: 6,  location: 'aisle-4' },
  { id: 'inv_025', productId: 'prod_025', quantity: 8,  minQuantity: 4,  location: 'counter' },
  { id: 'inv_040', productId: 'prod_040', quantity: 5,  minQuantity: 4,  location: 'aisle-4' },
];

// Build index for sales simulation
const invByProduct = new Map(INVENTORY.map(i => [i.productId, i]));

// ── Sales simulation helpers ──────────────────────────────────────────────────

// Montréal Canadiens home game dates (2025–26 season, approximate)
// ~41 home games, typically Tue/Wed/Thu/Sat evenings Oct–Apr
const GAME_DATES = new Set([
  '2025-11-01','2025-11-04','2025-11-06','2025-11-08','2025-11-11',
  '2025-11-13','2025-11-15','2025-11-18','2025-11-20','2025-11-22',
  '2025-11-25','2025-11-27','2025-11-29',
  '2025-12-02','2025-12-04','2025-12-06','2025-12-09','2025-12-11',
  '2025-12-13','2025-12-16','2025-12-18','2025-12-20','2025-12-23',
  '2026-01-03','2026-01-06','2026-01-08','2026-01-10','2026-01-13',
  '2026-01-15','2026-01-17','2026-01-20','2026-01-22','2026-01-24',
  '2026-01-27','2026-01-29','2026-01-31',
  '2026-02-03','2026-02-05','2026-02-07','2026-02-10','2026-02-12',
  '2026-02-14','2026-02-17','2026-02-19','2026-02-21','2026-02-24',
  '2026-02-26','2026-02-28',
  '2026-03-03','2026-03-05','2026-03-07','2026-03-10','2026-03-12',
  '2026-03-14','2026-03-17','2026-03-19','2026-03-21','2026-03-24',
  '2026-03-26','2026-03-28','2026-03-31',
  '2026-04-02','2026-04-04','2026-04-07','2026-04-09','2026-04-11',
  '2026-04-14','2026-04-16','2026-04-18',
]);

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

// Category revenue weights (must sum to 1.0)
const CATEGORY_WEIGHTS = [
  { category: 'beverages',     weight: 0.30 },
  { category: 'grab-n-go',    weight: 0.22 },
  { category: 'snacks',       weight: 0.18 },
  { category: 'chilled',      weight: 0.10 },
  { category: 'hot-drinks',   weight: 0.08 },
  { category: 'health',       weight: 0.06 },
  { category: 'fresh',        weight: 0.04 },
  { category: 'personal-care',weight: 0.02 },
];

// Build product pools by category
const PRODUCT_BY_CAT = new Map();
for (const p of PRODUCTS) {
  if (!PRODUCT_BY_CAT.has(p.category)) PRODUCT_BY_CAT.set(p.category, []);
  PRODUCT_BY_CAT.get(p.category).push(p);
}

function pickProduct(category) {
  const pool = PRODUCT_BY_CAT.get(category) || [];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickCategory() {
  const r = Math.random();
  let cum = 0;
  for (const { category, weight } of CATEGORY_WEIGHTS) {
    cum += weight;
    if (r < cum) return category;
  }
  return 'beverages';
}

/**
 * Generate a realistic transaction for a given day.
 * Returns { items: [{inventoryId, productId, quantity, unitPrice, lineTotal}], total }
 */
function generateTransaction() {
  const numItems = randInt(1, 4);
  const items = [];
  let total = 0;
  for (let i = 0; i < numItems; i++) {
    const cat = pickCategory();
    const product = pickProduct(cat);
    if (!product) continue;
    const inv = invByProduct.get(product.id);
    if (!inv) continue;
    const qty = randInt(1, 3);
    const lineTotal = parseFloat((product.price * qty).toFixed(2));
    items.push({
      inventoryId: inv.id,
      productId: product.id,
      quantity: qty,
      unitPrice: product.price,
      lineTotal,
    });
    total += lineTotal;
  }
  return { items, total: parseFloat(total.toFixed(2)) };
}

// ── Generate orders for date range ───────────────────────────────────────────

function generateDayOrders(date) {
  const ds = dateStr(date);
  const dow = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dow === 0 || dow === 6;
  const isGameDay = GAME_DATES.has(ds);
  const isHoliday = ['2025-12-25', '2025-12-26', '2026-01-01', '2026-02-16'].includes(ds);
  const isDecember = date.getMonth() === 11;

  // Target daily revenue
  let targetRevenue = 3548; // $106,458.33 / 30
  if (isWeekend) targetRevenue *= 1.25;
  if (isGameDay) targetRevenue *= 1.50;
  if (isHoliday) targetRevenue *= 0.30;
  if (isDecember) targetRevenue *= 1.15; // holiday season bump

  // Ramp-up: first 30 days store is new, traffic is lower
  const storeOpen = new Date('2025-11-01');
  const daysSinceOpen = Math.floor((date - storeOpen) / 86400000);
  if (daysSinceOpen < 30) {
    targetRevenue *= 0.4 + (daysSinceOpen / 30) * 0.6; // ramp 40%→100%
  }

  // Add noise ±15%
  targetRevenue *= rand(0.85, 1.15);

  const orders = [];
  let accumulatedRevenue = 0;

  // Average basket $35–45
  const avgBasket = rand(35, 45);
  const numOrders = Math.round(targetRevenue / avgBasket);

  for (let i = 0; i < numOrders; i++) {
    const tx = generateTransaction();
    if (tx.items.length === 0) continue;

    // Random time during business hours (7am–10pm), game days peak 5–7pm
    const hour = isGameDay
      ? (Math.random() < 0.4 ? randInt(17, 19) : randInt(7, 22))
      : randInt(7, 22);
    const minute = randInt(0, 59);
    const second = randInt(0, 59);
    const createdAt = new Date(date);
    createdAt.setHours(hour, minute, second, 0);

    orders.push({
      id: randomUUID(),
      ...tx,
      status: 'completed',
      createdAt,
    });
    accumulatedRevenue += tx.total;
    if (accumulatedRevenue >= targetRevenue) break;
  }
  return orders;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  console.log('Connected to PostgreSQL');

  try {
    // Check if already seeded
    const { rows: existing } = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(existing[0].count) > 0) {
      console.log(`Database already has ${existing[0].count} products — skipping seed. Run with --force to re-seed.`);
      if (!process.argv.includes('--force')) {
        return;
      }
      console.log('--force: truncating all tables...');
      await client.query('TRUNCATE tax_periods, expenses, expense_categories, order_items, orders, inventory, products RESTART IDENTITY CASCADE');
    }

    await client.query(
      `INSERT INTO tenants (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [DEFAULT_TENANT_ID, DEFAULT_STORE_NAME]
    );
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role`,
      [DEFAULT_USER_ID, DEFAULT_TENANT_ID, DEFAULT_USER_EMAIL, DEFAULT_PASSWORD_HASH]
    );

    console.log(`Seeding ${PRODUCTS.length} products...`);
    for (const p of PRODUCTS) {
      await client.query(
        `INSERT INTO products (id, tenant_id, name, sku, category, price, barcode, organic)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, DEFAULT_TENANT_ID, p.name, p.sku, p.category, p.price, p.barcode || null, p.organic]
      );
    }

    console.log(`Seeding ${INVENTORY.length} inventory items...`);
    for (const inv of INVENTORY) {
      await client.query(
        `INSERT INTO inventory (id, tenant_id, product_id, quantity, min_quantity, location, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [inv.id, DEFAULT_TENANT_ID, inv.productId, inv.quantity, inv.minQuantity, inv.location, inv.expiryDate || null]
      );
    }

    // Generate 6 months of orders: Nov 1, 2025 → Apr 21, 2026
    const startDate = new Date('2025-11-01');
    const endDate   = new Date('2026-04-21');
    let totalOrders = 0;
    let totalRevenue = 0;

    console.log('Generating 6 months of synthetic sales data...');

    const d = new Date(startDate);
    while (d <= endDate) {
      const dayOrders = generateDayOrders(new Date(d));

      for (const order of dayOrders) {
        await client.query(
          'INSERT INTO orders (id, tenant_id, total, status, created_at) VALUES ($1,$2,$3,$4,$5)',
          [order.id, DEFAULT_TENANT_ID, order.total, order.status, order.createdAt]
        );
        for (const it of order.items) {
          await client.query(
            `INSERT INTO order_items (tenant_id, order_id, inventory_id, product_id, quantity, unit_price, line_total)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [DEFAULT_TENANT_ID, order.id, it.inventoryId, it.productId, it.quantity, it.unitPrice, it.lineTotal]
          );
        }
        totalRevenue += order.total;
        totalOrders++;
      }

      // Progress every 30 days
      if (d.getDate() === 1) {
        console.log(`  ${dateStr(d)}: ${totalOrders} orders so far, $${totalRevenue.toFixed(0)} total revenue`);
      }

      d.setDate(d.getDate() + 1);
    }

    // ── Expense categories ────────────────────────────────────────────────────
    const EXPENSE_CATS = [
      { id: 'cat_wages',      name: 'Wages & Salaries',    account_code: '6100', tax_deductible: true,  itc_eligible: false },
      { id: 'cat_owner',      name: "Owner's Salary",      account_code: '6110', tax_deductible: true,  itc_eligible: false },
      { id: 'cat_payroll',    name: 'Payroll Taxes',       account_code: '6120', tax_deductible: true,  itc_eligible: false },
      { id: 'cat_rent',       name: 'Rent',                account_code: '6200', tax_deductible: true,  itc_eligible: true  },
      { id: 'cat_royalties',  name: 'Royalties',           account_code: '6300', tax_deductible: true,  itc_eligible: true  },
      { id: 'cat_pos',        name: 'POS & Payment Fees',  account_code: '6400', tax_deductible: true,  itc_eligible: true  },
      { id: 'cat_marketing',  name: 'Marketing',           account_code: '6500', tax_deductible: true,  itc_eligible: true  },
      { id: 'cat_accounting', name: 'Accounting & Legal',  account_code: '6600', tax_deductible: true,  itc_eligible: true  },
      { id: 'cat_telecom',    name: 'Telecom & Internet',  account_code: '6700', tax_deductible: true,  itc_eligible: true  },
      { id: 'cat_insurance',  name: 'Insurance',           account_code: '6800', tax_deductible: true,  itc_eligible: false },
      { id: 'cat_utilities',  name: 'Utilities',           account_code: '6900', tax_deductible: true,  itc_eligible: true  },
      { id: 'cat_supplies',   name: 'Store Supplies',      account_code: '6950', tax_deductible: true,  itc_eligible: true  },
      { id: 'cat_cogs',       name: 'Cost of Goods Sold',  account_code: '5000', tax_deductible: true,  itc_eligible: true  },
      { id: 'cat_bank',       name: 'Bank Fees',           account_code: '7000', tax_deductible: true,  itc_eligible: false },
    ];

    console.log('Seeding expense categories...');
    for (const c of EXPENSE_CATS) {
      await client.query(
        `INSERT INTO expense_categories (id, tenant_id, name, account_code, tax_deductible, itc_eligible)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [c.id, DEFAULT_TENANT_ID, c.name, c.account_code, c.tax_deductible, c.itc_eligible]
      );
    }

    // Monthly fixed expenses from projections (Year 1)
    const MONTHLY_FIXED = [
      { cat: 'cat_wages',      amount: 8466.00,  vendor: 'Payroll',              tps: 0,      tvq: 0      },
      { cat: 'cat_owner',      amount: 3984.00,  vendor: 'Owner Draw',           tps: 0,      tvq: 0      },
      { cat: 'cat_payroll',    amount: 1867.50,  vendor: 'CRA Remittance',       tps: 0,      tvq: 0      },
      { cat: 'cat_rent',       amount: 9962.49,  vendor: '1170 Bleury Landlord', tps: 498.12, tvq: 993.85 },
      { cat: 'cat_accounting', amount: 750.00,   vendor: 'Comptable Montréal',   tps: 37.50,  tvq: 74.81  },
      { cat: 'cat_telecom',    amount: 150.00,   vendor: 'Bell Business',        tps: 7.50,   tvq: 14.96  },
      { cat: 'cat_insurance',  amount: 150.00,   vendor: 'Intact Insurance',     tps: 0,      tvq: 0      },
      { cat: 'cat_bank',       amount: 45.00,    vendor: 'Desjardins',           tps: 0,      tvq: 0      },
    ];

    // Variable monthly expenses (% of revenue)
    // Using actual monthly revenue from orders seeded above
    const monthlyRevenue = {
      '2025-11': 89185, '2025-12': 145032,
      '2026-01': 133029, '2026-02': 126727,
      '2026-03': 131794, '2026-04': 86469,
    };

    console.log('Seeding 6 months of expenses...');
    let totalExpenses = 0;

    const months6 = ['2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];
    for (const monthKey of months6) {
      const [yr, mo] = monthKey.split('-').map(Number);
      const rev = monthlyRevenue[monthKey] || 106458;
      const lastDay = new Date(yr, mo, 0).getDate();

      // Fixed expenses — pay on 1st of each month
      for (const exp of MONTHLY_FIXED) {
        await client.query(
          `INSERT INTO expenses (id, tenant_id, category_id, description, amount, tps_paid, tvq_paid, vendor, reference, date, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'bank_feed')`,
          [randomUUID(), DEFAULT_TENANT_ID, exp.cat, exp.vendor, exp.amount, exp.tps, exp.tvq,
           exp.vendor, `${monthKey}-AUTO`, `${yr}-${String(mo).padStart(2,'0')}-01`]
        );
        totalExpenses += exp.amount;
      }

      // Royalties — 4.5% of revenue, paid by 15th
      const royalties = parseFloat((rev * 0.045).toFixed(2));
      const royTps = parseFloat((royalties * 0.05).toFixed(2));
      const royTvq = parseFloat((royalties * 0.09975).toFixed(2));
      await client.query(
        `INSERT INTO expenses (id, tenant_id, category_id, description, amount, tps_paid, tvq_paid, vendor, reference, date, source)
         VALUES ($1,$2,'cat_royalties',$3,$4,$5,$6,'Sam Saoudi / KaleMart24',$7,$8,'bank_feed')`,
        [randomUUID(), DEFAULT_TENANT_ID, `Royalties ${monthKey}`, royalties, royTps, royTvq,
         `ROY-${monthKey}`, `${yr}-${String(mo).padStart(2,'0')}-15`]
      );
      totalExpenses += royalties;

      // POS fees — ~2.31% of revenue
      const posFees = parseFloat((rev * 0.0231).toFixed(2));
      const posTps = parseFloat((posFees * 0.05).toFixed(2));
      const posTvq = parseFloat((posFees * 0.09975).toFixed(2));
      await client.query(
        `INSERT INTO expenses (id, tenant_id, category_id, description, amount, tps_paid, tvq_paid, vendor, reference, date, source)
         VALUES ($1,$2,'cat_pos',$3,$4,$5,$6,'Shopify Payments',$7,$8,'bank_feed')`,
        [randomUUID(), DEFAULT_TENANT_ID, `POS Fees ${monthKey}`, posFees, posTps, posTvq,
         `POS-${monthKey}`, `${yr}-${String(mo).padStart(2,'0')}-${lastDay}`]
      );
      totalExpenses += posFees;

      // Marketing — ~1% of revenue
      const mktg = parseFloat((rev * 0.01).toFixed(2));
      const mktgTps = parseFloat((mktg * 0.05).toFixed(2));
      const mktgTvq = parseFloat((mktg * 0.09975).toFixed(2));
      await client.query(
        `INSERT INTO expenses (id, tenant_id, category_id, description, amount, tps_paid, tvq_paid, vendor, reference, date, source)
         VALUES ($1,$2,'cat_marketing',$3,$4,$5,$6,'Meta / Instagram',$7,$8,'bank_feed')`,
        [randomUUID(), DEFAULT_TENANT_ID, `Social Media Ads ${monthKey}`, mktg, mktgTps, mktgTvq,
         `MKT-${monthKey}`, `${yr}-${String(mo).padStart(2,'0')}-05`]
      );
      totalExpenses += mktg;

      // COGS — KeHE deliveries (2x/week ≈ 8-9 per month, ~54.7% of revenue)
      const totalCogs = parseFloat((rev * 0.547).toFixed(2));
      const deliveries = 8;
      const perDelivery = parseFloat((totalCogs / deliveries).toFixed(2));
      for (let d = 0; d < deliveries; d++) {
        const day = 1 + Math.floor(d * (lastDay / deliveries));
        const keheTps = parseFloat((perDelivery * 0.05).toFixed(2));
        const keheTvq = parseFloat((perDelivery * 0.09975).toFixed(2));
        await client.query(
          `INSERT INTO expenses (id, tenant_id, category_id, description, amount, tps_paid, tvq_paid, vendor, reference, date, source)
           VALUES ($1,$2,'cat_cogs',$3,$4,$5,$6,'KeHE Distributors',$7,$8,'invoice')`,
          [randomUUID(), DEFAULT_TENANT_ID, `KeHE Invoice ${monthKey}-${d+1}`, perDelivery, keheTps, keheTvq,
           `KEHE-${monthKey}-${d+1}`, `${yr}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`]
        );
        totalExpenses += perDelivery;
      }

      // Utilities — flat $280/month
      await client.query(
        `INSERT INTO expenses (id, tenant_id, category_id, description, amount, tps_paid, tvq_paid, vendor, reference, date, source)
         VALUES ($1,$2,'cat_utilities','Hydro-Québec',$3,$4,$5,'Hydro-Québec',$6,$7,'bank_feed')`,
        [randomUUID(), DEFAULT_TENANT_ID, 280, 14, 27.93, `HQ-${monthKey}`,
         `${yr}-${String(mo).padStart(2,'0')}-20`]
      );
      totalExpenses += 280;

      // Store supplies — bags, labels, cleaning (~$150/month)
      const supplies = 150 + Math.floor(Math.random() * 80);
      await client.query(
        `INSERT INTO expenses (id, tenant_id, category_id, description, amount, tps_paid, tvq_paid, vendor, reference, date, source)
         VALUES ($1,$2,'cat_supplies','Store Supplies & Packaging',$3,$4,$5,'Staples / Uline',$6,$7,'manual')`,
        [randomUUID(), DEFAULT_TENANT_ID, supplies, parseFloat((supplies*0.05).toFixed(2)), parseFloat((supplies*0.09975).toFixed(2)),
         `SUP-${monthKey}`, `${yr}-${String(mo).padStart(2,'0')}-10`]
      );
      totalExpenses += supplies;
    }

    // ── Tax periods (quarterly) ───────────────────────────────────────────────
    // Q4 2025: Oct 1 – Dec 31, due Jan 31 2026
    // Q1 2026: Jan 1 – Mar 31, due Apr 30 2026
    // Q2 2026: Apr 1 – Jun 30, due Jul 31 2026 (partial — still open)
    const TAX_PERIODS = [
      { id: 'tp_2025_q4', start: '2025-10-01', end: '2025-12-31', due: '2026-01-31', status: 'filed' },
      { id: 'tp_2026_q1', start: '2026-01-01', end: '2026-03-31', due: '2026-04-30', status: 'open'  },
      { id: 'tp_2026_q2', start: '2026-04-01', end: '2026-06-30', due: '2026-07-31', status: 'open'  },
    ];
    for (const tp of TAX_PERIODS) {
      await client.query(
        `INSERT INTO tax_periods (id, tenant_id, period_start, period_end, filing_due, status)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [tp.id, DEFAULT_TENANT_ID, tp.start, tp.end, tp.due, tp.status]
      );
    }

    // Summary
    const months = (endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44);
    console.log('\n✅ Seed complete!');
    console.log(`   Products:      ${PRODUCTS.length}`);
    console.log(`   Inventory:     ${INVENTORY.length} SKUs`);
    console.log(`   Orders:        ${totalOrders.toLocaleString()}`);
    console.log(`   Total revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`   Avg/month:     $${(totalRevenue / months).toFixed(2)} (target: $106,458.33)`);
    console.log(`   Expenses:      $${totalExpenses.toFixed(2)}`);
    console.log(`   Period:        Nov 1, 2025 → Apr 21, 2026`);

  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
