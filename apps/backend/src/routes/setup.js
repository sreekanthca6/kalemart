const router = require('express').Router();
const { randomUUID } = require('crypto');
const { queryAsTenant, transactAsTenant } = require('../db/tenantQuery');

const SENSITIVE = new Set([
  'shopify_access_token',
  'shopify_webhook_secret',
  'anthropic_api_key',
  'plaid_secret',
]);

// All known setting keys grouped by section (drives the UI response)
const SECTIONS = {
  store: ['store_name', 'store_address'],
  shopify: ['shopify_shop_domain', 'shopify_access_token', 'shopify_webhook_secret'],
  plaid: ['plaid_client_id', 'plaid_secret', 'plaid_environment'],
  ai: ['anthropic_api_key'],
  tax: ['tax_business_number', 'tax_gst_number', 'tax_qst_number', 'tax_filing_frequency'],
};

// ── GET /api/setup/status ─────────────────────────────────────────────────────
// Returns which keys are set (never returns raw sensitive values)
router.get('/status', async (req, res, next) => {
  try {
    const { rows } = await queryAsTenant('SELECT key, value, updated_at FROM app_settings');
    const map = new Map(rows.map(r => [r.key, r]));

    const result = {};
    for (const [section, keys] of Object.entries(SECTIONS)) {
      result[section] = {};
      for (const key of keys) {
        const row = map.get(key);
        const hasValue = !!(row?.value?.trim());
        result[section][key] = {
          set: hasValue,
          updated_at: row?.updated_at || null,
          // Return non-sensitive values so fields can be pre-filled
          value: hasValue && !SENSITIVE.has(key) ? row.value : null,
        };
      }
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ── POST /api/setup/config ────────────────────────────────────────────────────
// Saves one or more settings, applies them to live config immediately
router.post('/config', async (req, res, next) => {
  try {
    const updates = req.body; // { key: value, ... }
    const saved = [];

    for (const [key, value] of Object.entries(updates)) {
      // Allow explicit clear (empty string means delete the setting)
      if (value === null || value === undefined) continue;

      if (value === '') {
        await queryAsTenant('DELETE FROM app_settings WHERE key = $1 AND tenant_id = current_setting(\'app.current_tenant_id\')', [key]);
      } else {
        await queryAsTenant(`
          INSERT INTO app_settings (tenant_id, key, value, updated_at)
          VALUES (current_setting('app.current_tenant_id'), $1, $2, NOW())
          ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `, [key, String(value).trim()]);
      }
      saved.push(key);
    }

    res.json({ ok: true, saved });
  } catch (e) { next(e); }
});

// ── GET /api/setup/shopify/urls ───────────────────────────────────────────────
// Returns the webhook URLs to register in Shopify admin
router.get('/shopify/urls', (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host  = req.headers['x-forwarded-host'] || req.get('host') || 'your-domain.com';
  const base  = `${proto}://${host}`;
  res.json({
    orders:   `${base}/api/shopify/webhooks/orders`,
    products: `${base}/api/shopify/webhooks/products`,
  });
});

// ── POST /api/setup/products/import ──────────────────────────────────────────
// Accepts CSV text, upserts products by SKU
router.post('/products/import', async (req, res, next) => {
  try {
    const { csv, replaceAll = false } = req.body;
    if (!csv?.trim()) {
      const e = new Error('csv field is required'); e.status = 400; throw e;
    }

    const lines = csv.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      const e = new Error('CSV must have a header row and at least one data row'); e.status = 400; throw e;
    }

    // Normalize header names
    const ALIASES = {
      'product name': 'name', 'product': 'name', 'title': 'name',
      'item': 'name', 'item name': 'name',
      'product sku': 'sku', 'item sku': 'sku', 'code': 'sku',
      'product category': 'category', 'type': 'category', 'department': 'category',
      'retail price': 'price', 'selling price': 'price', 'unit price': 'price',
      'cost price': 'cost', 'unit cost': 'cost', 'wholesale': 'cost',
      'upc': 'barcode', 'ean': 'barcode', 'upc/ean': 'barcode',
    };

    const parseCSVLine = line => {
      const cols = []; let cur = ''; let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      cols.push(cur.trim());
      return cols;
    };

    const rawHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9 /]/g, '').trim());
    const headers = rawHeaders.map(h => ALIASES[h] || h);

    const required = ['name', 'sku', 'category', 'price'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length) {
      const e = new Error(`CSV is missing required columns: ${missing.join(', ')}. Found: ${headers.join(', ')}`);
      e.status = 400; throw e;
    }

    const col = key => headers.indexOf(key);

    const { inserted, updated, skipped } = await transactAsTenant(async client => {
      if (replaceAll) {
        await client.query(`
          DELETE FROM products WHERE id NOT IN (
            SELECT DISTINCT product_id FROM order_items WHERE product_id IS NOT NULL
          )
        `);
      }

      let inserted = 0, updated = 0, skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const get = key => col(key) >= 0 ? (cols[col(key)] || '').replace(/^"|"$/g, '').trim() : '';

        const name     = get('name');
        const sku      = get('sku');
        const category = get('category').toLowerCase().replace(/\s+/g, '-');
        const price    = parseFloat(get('price').replace(/[$,]/g, ''));
        const cost     = get('cost') ? parseFloat(get('cost').replace(/[$,]/g, '')) : null;
        const barcode  = get('barcode') || null;
        const organic  = get('organic')?.toLowerCase() === 'true' || get('organic') === '1';

        if (!name || !sku || isNaN(price)) { skipped++; continue; }

        const { rows: existing } = await client.query(
          'SELECT id FROM products WHERE sku = $1', [sku]
        );

        if (existing.length) {
          await client.query(`
            UPDATE products SET name=$1, category=$2, price=$3, barcode=$4, organic=$5
            WHERE sku=$6
          `, [name, category, price, barcode, organic, sku]);

          if (cost !== null) {
            await client.query(
              'UPDATE products SET cost=$1 WHERE sku=$2', [cost, sku]
            ).catch(() => {});
          }
          updated++;
        } else {
          const id = `prod_${randomUUID().replace(/-/g,'').slice(0,8)}`;
          await client.query(`
            INSERT INTO products (id, tenant_id, name, sku, category, price, barcode, organic)
            VALUES ($1, current_setting('app.current_tenant_id'), $2, $3, $4, $5, $6, $7)
          `, [id, name, sku, category, price, barcode, organic]);

          const invId = `inv_${randomUUID().replace(/-/g,'').slice(0,8)}`;
          await client.query(`
            INSERT INTO inventory (id, tenant_id, product_id, quantity, min_quantity, location)
            VALUES ($1, current_setting('app.current_tenant_id'), $2, 0, 5, 'Main shelf')
          `, [invId, id]);

          inserted++;
        }
      }

      return { inserted, updated, skipped };
    });

    res.json({ ok: true, inserted, updated, skipped, total: inserted + updated });
  } catch (e) { next(e); }
});

// ── GET /api/setup/products/count ─────────────────────────────────────────────
router.get('/products/count', async (req, res, next) => {
  try {
    const { rows } = await queryAsTenant('SELECT COUNT(*)::int AS count FROM products');
    res.json({ count: rows[0].count });
  } catch (e) { next(e); }
});

module.exports = router;
