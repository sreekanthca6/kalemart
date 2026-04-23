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

-- ── Multi-tenancy ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add tenant_id to all data tables (nullable first for safe migration)
ALTER TABLE products          ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE inventory         ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE orders            ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE order_items       ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE expenses          ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE tax_periods        ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE app_settings       ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Seed default tenant for existing data (idempotent)
INSERT INTO tenants (id, name) VALUES ('tenant_default', 'KaleMart24')
ON CONFLICT (id) DO NOTHING;

-- Backfill existing rows
UPDATE products           SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL;
UPDATE inventory          SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL;
UPDATE orders             SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL;
UPDATE order_items        SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL;
UPDATE expenses           SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL;
UPDATE expense_categories SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL;
UPDATE tax_periods         SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL;
UPDATE app_settings        SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL;

-- Set NOT NULL (safe after backfill)
DO $$ BEGIN ALTER TABLE products          ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE inventory         ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders            ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE order_items       ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses          ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expense_categories ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tax_periods        ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE app_settings       ALTER COLUMN tenant_id SET NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- Migrate app_settings primary key from (key) to (tenant_id, key)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app_settings'::regclass AND contype = 'p' AND array_length(conkey, 1) = 2
  ) THEN
    ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
    ALTER TABLE app_settings ADD PRIMARY KEY (tenant_id, key);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_tenant    ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant   ON inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant      ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant    ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_periods_tenant ON tax_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_tenant ON app_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expense_cats_tenant ON expense_categories(tenant_id);

-- Non-superuser app role so RLS is enforced (superusers bypass RLS even with FORCE)
DO $$ BEGIN
  CREATE ROLE kalemart_app WITH NOLOGIN NOSUPERUSER NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public TO kalemart_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kalemart_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kalemart_app;

-- Enable Row Level Security
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_periods        ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings       ENABLE ROW LEVEL SECURITY;

-- FORCE applies RLS even to the table owner
ALTER TABLE products           FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory          FORCE ROW LEVEL SECURITY;
ALTER TABLE orders             FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items        FORCE ROW LEVEL SECURITY;
ALTER TABLE expenses           FORCE ROW LEVEL SECURITY;
ALTER TABLE expense_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE tax_periods        FORCE ROW LEVEL SECURITY;
ALTER TABLE app_settings       FORCE ROW LEVEL SECURITY;

-- RLS policies: no tenant context → zero rows (safe by default)
DROP POLICY IF EXISTS tenant_isolation ON products;
DROP POLICY IF EXISTS tenant_isolation ON inventory;
DROP POLICY IF EXISTS tenant_isolation ON orders;
DROP POLICY IF EXISTS tenant_isolation ON order_items;
DROP POLICY IF EXISTS tenant_isolation ON expenses;
DROP POLICY IF EXISTS tenant_isolation ON expense_categories;
DROP POLICY IF EXISTS tenant_isolation ON tax_periods;
DROP POLICY IF EXISTS tenant_isolation ON app_settings;

CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation ON inventory
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation ON order_items
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation ON expenses
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation ON expense_categories
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation ON tax_periods
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation ON app_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
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
