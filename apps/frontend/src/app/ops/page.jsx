'use client';
import useSWR from 'swr';
import { fetcher } from '../../lib/api';

function Card({ title, children }) {
  return (
    <section className="card" style={{ padding: 22 }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-3)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginBottom: 14,
      }}>{title}</p>
      {children}
    </section>
  );
}

function Status({ value }) {
  const good = ['ready', 'ok', 'configured'].includes(String(value).toLowerCase());
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      color: good ? 'var(--brand)' : 'var(--amber)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      fontWeight: 600,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: good ? 'var(--brand)' : 'var(--amber)' }} />
      {value || 'missing'}
    </span>
  );
}

function Metric({ label, value, color = 'var(--text)' }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function Row({ label, value, status }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{label}</span>
      {status ? <Status value={value} /> : <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right' }}>{value ?? '—'}</span>}
    </div>
  );
}

export default function OpsPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/ops/readiness', fetcher, { refreshInterval: 10000 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Deployment Control</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 400, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1 }}>Operations</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>Live readiness, telemetry, data health, and integration state.</p>
        </div>
        <button onClick={() => mutate()} style={{ background: 'var(--brand)', color: '#0c1510', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
      </div>

      {isLoading && <Card title="Status"><p style={{ color: 'var(--text-3)' }}>Loading readiness…</p></Card>}
      {error && <Card title="Status"><p style={{ color: 'var(--critical)' }}>Readiness failed: {error.message}</p></Card>}

      {data && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
            <Card title="API"><Metric label="Status" value={data.status} color="var(--brand)" /></Card>
            <Card title="Tenant"><Metric label="Products" value={data.tenant.products} /></Card>
            <Card title="Stock"><Metric label="Low" value={data.tenant.lowStock} color="var(--amber)" /></Card>
            <Card title="Stock"><Metric label="Out" value={data.tenant.outOfStock} color="var(--critical)" /></Card>
            <Card title="Orders"><Metric label="History" value={data.tenant.orders.toLocaleString('en-CA')} color="var(--info)" /></Card>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card title="Runtime">
              <Row label="Environment" value={data.service.env} />
              <Row label="Version" value={data.service.version} />
              <Row label="Node" value={data.deployment.node} />
              <Row label="Uptime" value={`${data.service.uptimeSec}s`} />
              <Row label="Readiness latency" value={`${data.latencyMs}ms`} />
            </Card>

            <Card title="OpenTelemetry">
              <Row label="Collector endpoint" value={data.integrations.otel.endpoint} />
              <Row label="Service name" value={data.integrations.otel.serviceName} />
              <Row label="Exporter" value={data.integrations.otel.status} status />
              <Row label="Database" value={data.database.status} status />
              <Row label="Checked at" value={new Date(data.checkedAt).toLocaleString('en-CA')} />
            </Card>
          </div>

          <Card title="Integrations">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18 }}>
              <div><Row label="AI service" value={data.integrations.aiService.status} status /><Row label="URL" value={data.integrations.aiService.url} /></div>
              <div><Row label="Anthropic" value={data.integrations.anthropic.status} status /></div>
              <div><Row label="Shopify token" value={data.integrations.shopify.accessToken} status /><Row label="Shop domain" value={data.integrations.shopify.shopDomain} /></div>
              <div><Row label="Webhook secret" value={data.integrations.shopify.webhookSecret} status /><Row label="Tenant" value={data.tenant.id} /></div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
