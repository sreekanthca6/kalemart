'use client';
import { useState, useEffect, useRef } from 'react';
import { authFetch } from '../../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = '/api';

function Badge({ configured }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
      background: configured ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.06)',
      color: configured ? '#34c759' : '#636366',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: configured ? '#34c759' : '#48484a', display: 'inline-block' }} />
      {configured ? 'Configured' : 'Not set'}
    </span>
  );
}

function Field({ label, field, value, onChange, sensitive, placeholder, hint, type = 'text', options }) {
  const [show, setShow] = useState(false);

  if (options) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, color: '#8e8e93', fontFamily: 'var(--font-body)' }}>{label}</label>
        <select
          value={value || ''}
          onChange={e => onChange(field, e.target.value)}
          style={{
            background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#ffffff',
            fontFamily: 'var(--font-body)', outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">Select…</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {hint && <p style={{ fontSize: 11, color: '#636366', margin: 0 }}>{hint}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: '#8e8e93', fontFamily: 'var(--font-body)' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={sensitive && !show ? 'password' : type}
          value={value || ''}
          onChange={e => onChange(field, e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: sensitive ? '9px 38px 9px 12px' : '9px 12px',
            fontSize: 13, color: '#ffffff', fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--brand)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
        {sensitive && (
          <button
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#636366',
              fontSize: 11, fontFamily: 'var(--font-mono)', padding: '2px 4px',
            }}
          >{show ? 'hide' : 'show'}</button>
        )}
      </div>
      {hint && <p style={{ fontSize: 11, color: '#636366', margin: 0 }}>{hint}</p>}
    </div>
  );
}

function CopyBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <span style={{ fontSize: 11, color: '#8e8e93', fontFamily: 'var(--font-body)' }}>{label}</span>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: '#1c1c1e', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>
        <span style={{
          flex: 1, padding: '8px 12px', fontSize: 12,
          fontFamily: 'var(--font-mono)', color: '#aeaeb2',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{value}</span>
        <button
          onClick={copy}
          style={{
            padding: '8px 14px', background: copied ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.06)',
            border: 'none', borderLeft: '1px solid rgba(255,255,255,0.06)',
            color: copied ? '#34c759' : '#8e8e93', cursor: 'pointer',
            fontSize: 11, fontFamily: 'var(--font-mono)', flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >{copied ? '✓ copied' : 'copy'}</button>
      </div>
    </div>
  );
}

function SaveButton({ saving, saved, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        padding: '9px 22px', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
        background: saved ? 'rgba(52,199,89,0.15)' : 'var(--brand)',
        color: saved ? '#34c759' : '#0c1510',
        fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
        transition: 'all 0.2s', opacity: saving ? 0.6 : 1,
      }}
    >
      {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
    </button>
  );
}

function SectionCard({ icon, title, description, configured, children }) {
  return (
    <div style={{
      background: '#2c2c2e', borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '20px 24px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: configured ? 'rgba(52,199,89,0.1)' : 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>{icon}</div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: '#fff', fontFamily: 'var(--font-display)' }}>{title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#8e8e93', fontFamily: 'var(--font-body)' }}>{description}</p>
          </div>
        </div>
        <Badge configured={configured} />
      </div>
      <div style={{ padding: '20px 24px 24px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [status, setStatus] = useState(null);
  const [webhookUrls, setWebhookUrls] = useState(null);
  const [productCount, setProductCount] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/setup/status`).then(r => r.json()),
      authFetch(`${API}/setup/shopify/urls`).then(r => r.json()),
      authFetch(`${API}/setup/products/count`).then(r => r.json()),
    ]).then(([s, urls, count]) => {
      setStatus(s);
      setWebhookUrls(urls);
      setProductCount(count.count);
      // Pre-fill non-sensitive values
      const initial = {};
      for (const section of Object.values(s)) {
        for (const [key, meta] of Object.entries(section)) {
          if (meta.value) initial[key] = meta.value;
        }
      }
      setForm(initial);
    });
  }, []);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const saveSection = async (sectionId, keys) => {
    setSaving(s => ({ ...s, [sectionId]: true }));
    const payload = {};
    for (const key of keys) {
      if (form[key] !== undefined) payload[key] = form[key];
    }
    try {
      await authFetch(`${API}/setup/config`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      // Refresh status
      const fresh = await authFetch(`${API}/setup/status`).then(r => r.json());
      setStatus(fresh);
      setSaved(s => ({ ...s, [sectionId]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [sectionId]: false })), 3000);
    } finally {
      setSaving(s => ({ ...s, [sectionId]: false }));
    }
  };

  const handleFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target.result);
    reader.readAsText(file);
  };

  const importProducts = async (replaceAll = false) => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const r = await authFetch(`${API}/setup/products/import`, {
        method: 'POST',
        body: JSON.stringify({ csv: csvText, replaceAll }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Import failed');
      setImportResult({ ok: true, ...data });
      const count = await authFetch(`${API}/setup/products/count`).then(r => r.json());
      setProductCount(count.count);
    } catch (err) {
      setImportResult({ ok: false, error: err.message });
    } finally {
      setImporting(false);
    }
  };

  if (!status) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#636366', fontFamily: 'var(--font-body)' }}>
        Loading…
      </div>
    );
  }

  const isConfigured = section => {
    const keys = Object.values(status[section] || {});
    return keys.some(k => k.set);
  };

  const allConfigured = ['shopify', 'ai', 'tax'].filter(s => isConfigured(s)).length;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{
            margin: 0, fontSize: 26, fontWeight: 700,
            fontFamily: 'var(--font-display)', color: '#ffffff', letterSpacing: '-0.02em',
          }}>Store Setup</h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)', borderRadius: 99, padding: '6px 14px',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', position: 'relative',
              background: '#3a3a3c',
            }}>
              <svg viewBox="0 0 28 28" style={{ position: 'absolute', inset: 0 }}>
                <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5"/>
                <circle cx="14" cy="14" r="12" fill="none" stroke="var(--brand)" strokeWidth="2.5"
                  strokeDasharray={`${(allConfigured/3)*75.4} 75.4`}
                  strokeLinecap="round" transform="rotate(-90 14 14)"
                  style={{ transition: 'stroke-dasharray 0.4s' }}/>
              </svg>
            </div>
            <span style={{ fontSize: 13, color: '#aeaeb2', fontFamily: 'var(--font-body)' }}>
              {allConfigured}/3 integrations ready
            </span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#636366', fontFamily: 'var(--font-body)' }}>
          Configure integrations once — everything updates live without restarting.
        </p>
      </div>

      {/* ── Store Info ─────────────────────────────────────────────────── */}
      <SectionCard icon="🏪" title="Store Info" description="Basic details shown across the dashboard." configured={isConfigured('store')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <Field label="Store Name" field="store_name" value={form.store_name} onChange={update}
            placeholder="KaleMart24 — Rue de Bleury" />
          <Field label="Address" field="store_address" value={form.store_address} onChange={update}
            placeholder="1170 Rue de Bleury, Montréal, QC" />
        </div>
        <SaveButton saving={saving.store} saved={saved.store} onClick={() => saveSection('store', ['store_name', 'store_address'])} />
      </SectionCard>

      {/* ── Products ───────────────────────────────────────────────────── */}
      <SectionCard
        icon="📦"
        title="Product Catalog"
        description={`Import your SKU list. Currently ${productCount ?? '…'} products in database.`}
        configured={productCount > 0}
      >
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#8e8e93', fontFamily: 'var(--font-body)' }}>
            Required columns: <code style={{ color: 'var(--brand)', background: 'rgba(100,220,130,0.08)', padding: '1px 5px', borderRadius: 4 }}>name, sku, category, price</code>
            &nbsp; — Optional: <code style={{ color: '#8e8e93' }}>cost, barcode, organic</code>
          </p>

          {/* File drop area */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '20px', textAlign: 'center', cursor: 'pointer',
              background: 'rgba(255,255,255,0.02)', marginBottom: 10,
              transition: 'border-color 0.15s',
            }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--brand)'; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              const file = e.dataTransfer.files?.[0];
              if (file) { const r = new FileReader(); r.onload = ev => setCsvText(ev.target.result); r.readAsText(file); }
            }}
          >
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
            <p style={{ margin: 0, color: '#636366', fontSize: 13, fontFamily: 'var(--font-body)' }}>
              {csvText ? `✓ ${csvText.trim().split('\n').length - 1} rows loaded` : 'Drop CSV file here or click to browse'}
            </p>
          </div>

          {/* Or paste */}
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={'name,sku,category,price,cost,barcode\nOatly Oat Milk 1L,OAT001,beverages,4.99,2.50,7318869062835\n…'}
            rows={5}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '10px 12px', fontSize: 12,
              color: '#aeaeb2', fontFamily: 'var(--font-mono)', resize: 'vertical',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--brand)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>

        {importResult && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 14,
            background: importResult.ok ? 'rgba(52,199,89,0.1)' : 'rgba(255,69,58,0.1)',
            color: importResult.ok ? '#34c759' : '#ff453a',
            fontSize: 13, fontFamily: 'var(--font-body)',
          }}>
            {importResult.ok
              ? `✓ Imported ${importResult.total} products (${importResult.inserted} new, ${importResult.updated} updated${importResult.skipped ? `, ${importResult.skipped} skipped` : ''})`
              : `✗ ${importResult.error}`}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => importProducts(false)}
            disabled={importing || !csvText.trim()}
            style={{
              padding: '9px 22px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#0c1510',
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
              cursor: importing || !csvText.trim() ? 'not-allowed' : 'pointer',
              opacity: importing || !csvText.trim() ? 0.5 : 1,
            }}
          >{importing ? 'Importing…' : 'Import (add / update)'}</button>
          <button
            onClick={() => importProducts(true)}
            disabled={importing || !csvText.trim()}
            style={{
              padding: '9px 22px', borderRadius: 8,
              border: '1px solid rgba(255,69,58,0.3)',
              background: 'rgba(255,69,58,0.08)', color: '#ff453a',
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
              cursor: importing || !csvText.trim() ? 'not-allowed' : 'pointer',
              opacity: importing || !csvText.trim() ? 0.5 : 1,
            }}
          >Replace all</button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#48484a', fontFamily: 'var(--font-body)' }}>
          &quot;Replace all&quot; only removes products with no order history. New inventory rows are created at quantity 0.
        </p>
      </SectionCard>

      {/* ── Shopify / POS ──────────────────────────────────────────────── */}
      <SectionCard icon="🛒" title="Shopify / POS" description="Live order sync — inventory updates automatically on each sale." configured={isConfigured('shopify')}>
        <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Shop Domain" field="shopify_shop_domain" value={form.shopify_shop_domain} onChange={update}
            placeholder="yourstore.myshopify.com"
            hint="Found in Shopify admin → Settings → Domains" />
          <Field label="Access Token" field="shopify_access_token" value={form.shopify_access_token} onChange={update}
            sensitive placeholder="shpat_…" hint="Shopify admin → Apps → Develop apps → API credentials" />
          <Field label="Webhook Secret" field="shopify_webhook_secret" value={form.shopify_webhook_secret} onChange={update}
            sensitive placeholder="Generated when you create the webhook"
            hint="Shopify admin → Settings → Notifications → Webhooks" />
        </div>

        {webhookUrls && (
          <div style={{ marginBottom: 18, padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#8e8e93', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Register these webhook URLs in Shopify admin:</p>
            <CopyBox label="Orders Created / Paid" value={webhookUrls.orders} />
            <CopyBox label="Products Created / Updated" value={webhookUrls.products} />
          </div>
        )}

        <SaveButton saving={saving.shopify} saved={saved.shopify}
          onClick={() => saveSection('shopify', ['shopify_shop_domain', 'shopify_access_token', 'shopify_webhook_secret'])} />
      </SectionCard>

      {/* ── Plaid (Banking) ────────────────────────────────────────────── */}
      <SectionCard icon="🏦" title="Plaid — Bank Feed" description="Auto-import bank transactions as bookkeeping expenses." configured={isConfigured('plaid')}>
        <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Client ID" field="plaid_client_id" value={form.plaid_client_id} onChange={update}
              placeholder="From Plaid dashboard" />
            <Field label="Secret" field="plaid_secret" value={form.plaid_secret} onChange={update}
              sensitive placeholder="Sandbox or production secret" />
          </div>
          <Field label="Environment" field="plaid_environment" value={form.plaid_environment} onChange={update}
            options={[
              { value: 'sandbox', label: 'Sandbox (testing)' },
              { value: 'development', label: 'Development' },
              { value: 'production', label: 'Production' },
            ]}
            hint="Use Sandbox while testing, switch to Production when your bank account is connected." />
        </div>
        <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(255,159,10,0.08)', borderRadius: 8, border: '1px solid rgba(255,159,10,0.15)' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#ff9f0a', fontFamily: 'var(--font-body)' }}>
            After saving, a &quot;Connect Bank Account&quot; button will appear in Bookkeeping to launch the Plaid Link flow. Transactions will auto-categorize into your expense ledger.
          </p>
        </div>
        <SaveButton saving={saving.plaid} saved={saved.plaid}
          onClick={() => saveSection('plaid', ['plaid_client_id', 'plaid_secret', 'plaid_environment'])} />
      </SectionCard>

      {/* ── Supervisor AI ──────────────────────────────────────────────── */}
      <SectionCard icon="✦" title="Supervisor — AI" description="Upgrade from demo mode to Claude-powered inventory intelligence." configured={isConfigured('ai')}>
        <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Anthropic API Key" field="anthropic_api_key" value={form.anthropic_api_key} onChange={update}
            sensitive placeholder="sk-ant-…"
            hint="console.anthropic.com → API Keys → Create key" />
        </div>
        <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(100,220,130,0.06)', borderRadius: 8, border: '1px solid rgba(100,220,130,0.12)' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#8e8e93', fontFamily: 'var(--font-body)' }}>
            Without a key, Supervisor runs in <strong style={{ color: '#aeaeb2' }}>demo mode</strong> — rule-based recommendations that still catch expiry, low stock, and game-day opportunities.
            With a key it switches to <strong style={{ color: 'var(--brand)' }}>Claude-powered mode</strong> — contextual reasoning across your full inventory, events, and sales history.
          </p>
        </div>
        <SaveButton saving={saving.ai} saved={saved.ai}
          onClick={() => saveSection('ai', ['anthropic_api_key'])} />
      </SectionCard>

      {/* ── Tax Registration ───────────────────────────────────────────── */}
      <SectionCard icon="🧾" title="Tax Registration" description="Quebec TPS/TVQ filing details for your quarterly returns." configured={isConfigured('tax')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="CRA Business Number" field="tax_business_number" value={form.tax_business_number} onChange={update}
              placeholder="123456789" hint="9-digit number from CRA" />
            <Field label="GST/HST Registration #" field="tax_gst_number" value={form.tax_gst_number} onChange={update}
              placeholder="123456789 RT0001" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="QST Registration #" field="tax_qst_number" value={form.tax_qst_number} onChange={update}
              placeholder="1234567890 TQ0001" hint="From Revenu Québec" />
            <Field label="Filing Frequency" field="tax_filing_frequency" value={form.tax_filing_frequency} onChange={update}
              options={[
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'annual', label: 'Annual' },
              ]}
              hint="New businesses typically file quarterly." />
          </div>
        </div>
        <SaveButton saving={saving.tax} saved={saved.tax}
          onClick={() => saveSection('tax', ['tax_business_number', 'tax_gst_number', 'tax_qst_number', 'tax_filing_frequency'])} />
      </SectionCard>

      <div style={{ height: 24 }} />
    </div>
  );
}
