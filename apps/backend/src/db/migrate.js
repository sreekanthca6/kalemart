const pool = require('./pool');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT        NOT NULL,
  sku         TEXT UNIQUE NOT NULL,
  category    TEXT        NOT NULL,
  price       NUMERIC(8,2) NOT NULL,
  barcode     TEXT,
  organic     BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id           TEXT PRIMARY KEY,
  product_id   TEXT REFERENCES products(id) ON DELETE CASCADE,
  quantity     INTEGER      NOT NULL DEFAULT 0,
  min_quantity INTEGER      NOT NULL DEFAULT 0,
  location     TEXT         NOT NULL,
  expiry_date  TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id         TEXT PRIMARY KEY,
  total      NUMERIC(8,2) NOT NULL,
  status     TEXT         NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     TEXT REFERENCES orders(id) ON DELETE CASCADE,
  inventory_id TEXT,
  product_id   TEXT REFERENCES products(id),
  quantity     INTEGER      NOT NULL,
  unit_price   NUMERIC(8,2),
  line_total   NUMERIC(8,2)
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON orders(created_at DESC);

-- ── Bookkeeping ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expense_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  account_code TEXT NOT NULL,
  tax_deductible BOOLEAN DEFAULT true,
  itc_eligible   BOOLEAN DEFAULT true  -- input tax credit eligible
);

CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY,
  category_id  TEXT REFERENCES expense_categories(id),
  description  TEXT NOT NULL,
  amount       NUMERIC(8,2) NOT NULL,
  tps_paid     NUMERIC(8,2) DEFAULT 0,   -- GST paid on this expense (ITC)
  tvq_paid     NUMERIC(8,2) DEFAULT 0,   -- QST paid on this expense (ITR)
  vendor       TEXT,
  reference    TEXT,                      -- invoice # or cheque #
  date         DATE NOT NULL,
  source       TEXT DEFAULT 'manual',     -- manual | bank_feed | invoice
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tax_periods (
  id           TEXT PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  filing_due   DATE NOT NULL,
  status       TEXT DEFAULT 'open',       -- open | filed | paid
  tps_collected  NUMERIC(10,2) DEFAULT 0,
  tvq_collected  NUMERIC(10,2) DEFAULT 0,
  tps_itc        NUMERIC(10,2) DEFAULT 0, -- input tax credits
  tvq_itr        NUMERIC(10,2) DEFAULT 0, -- input tax refunds
  tps_net        NUMERIC(10,2) DEFAULT 0,
  tvq_net        NUMERIC(10,2) DEFAULT 0,
  filed_at     TIMESTAMPTZ,
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

-- ── App settings (runtime config, overrides env vars) ────────────────────────

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7438291650)');
    await client.query(SCHEMA);
    console.log(JSON.stringify({ event: 'db_migrate', status: 'ok' }));
  } finally {
    await client.query('SELECT pg_advisory_unlock(7438291650)').catch(() => {});
    client.release();
  }
}

module.exports = { migrate };
