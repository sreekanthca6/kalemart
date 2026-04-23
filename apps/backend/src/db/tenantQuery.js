const { AsyncLocalStorage } = require('async_hooks');
const pool = require('./pool');

const tenantContext = new AsyncLocalStorage();

function runWithTenant(tenantId, fn) {
  return tenantContext.run({ tenantId }, fn);
}

function currentTenantId() {
  const store = tenantContext.getStore();
  if (!store?.tenantId) throw Object.assign(new Error('No tenant context'), { status: 401 });
  return store.tenantId;
}

async function queryAsTenant(text, params) {
  const tenantId = currentTenantId();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE kalemart_app');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId]);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function transactAsTenant(fn) {
  const tenantId = currentTenantId();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE kalemart_app');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { runWithTenant, queryAsTenant, transactAsTenant };
