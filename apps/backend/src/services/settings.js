const pool   = require('../db/pool');
const config = require('../config');

// Map DB setting keys → how they update the live config object
const APPLIERS = {
  shopify_shop_domain:      v => { config.shopify.shopDomain      = v; },
  shopify_access_token:     v => { config.shopify.accessToken      = v; },
  shopify_webhook_secret:   v => { config.shopify.webhookSecret    = v; },
  anthropic_api_key:        v => { config.anthropicApiKey          = v; },
  plaid_client_id:          v => { config.plaid = config.plaid || {}; config.plaid.clientId     = v; },
  plaid_secret:             v => { config.plaid = config.plaid || {}; config.plaid.secret       = v; },
  plaid_environment:        v => { config.plaid = config.plaid || {}; config.plaid.environment  = v; },
  store_name:               v => { config.storeName    = v; },
  store_address:            v => { config.storeAddress = v; },
  tax_gst_number:           v => { config.tax = config.tax || {}; config.tax.gstNumber  = v; },
  tax_qst_number:           v => { config.tax = config.tax || {}; config.tax.qstNumber  = v; },
  tax_business_number:      v => { config.tax = config.tax || {}; config.tax.businessNumber = v; },
  tax_filing_frequency:     v => { config.tax = config.tax || {}; config.tax.filingFrequency = v; },
};

async function loadSettings() {
  try {
    const { rows } = await pool.query(
      "SELECT key, value FROM app_settings WHERE value IS NOT NULL AND value != ''"
    );
    for (const { key, value } of rows) {
      APPLIERS[key]?.(value);
    }
    if (rows.length > 0) {
      console.log(JSON.stringify({ event: 'settings_loaded', count: rows.length }));
    }
  } catch (err) {
    // Table may not exist on first boot before migrate — silently skip
    if (!err.message?.includes('does not exist')) {
      console.error(JSON.stringify({ event: 'settings_load_error', error: err.message }));
    }
  }
}

function applyToConfig(key, value) {
  APPLIERS[key]?.(value);
}

module.exports = { loadSettings, applyToConfig };
