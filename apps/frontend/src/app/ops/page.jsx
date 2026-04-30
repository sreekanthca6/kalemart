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

function EvidenceTile({ label, value, detail, color = 'var(--brand)' }) {
  const glow = color === 'var(--brand)' ? 'rgba(126,200,122,0.14)' : 'rgba(84,160,255,0.12)';
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 18,
      padding: 18,
      background: `linear-gradient(135deg, ${glow}, rgba(255,255,255,0.03))`,
      minHeight: 142,
    }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</p>
      <p style={{ marginTop: 12, fontFamily: 'var(--font-display)', fontSize: 34, color, lineHeight: 1 }}>{value}</p>
      <p style={{ marginTop: 10, color: 'var(--text-2)', fontSize: 12, lineHeight: 1.45 }}>{detail}</p>
    </div>
  );
}

function SkillPill({ children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      border: '1px solid var(--border-mid)',
      borderRadius: 999,
      padding: '7px 10px',
      color: 'var(--text-2)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      background: 'rgba(255,255,255,0.03)',
    }}>{children}</span>
  );
}

function SignalCard({ name, query, dashboard }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 16,
      background: 'rgba(126,200,122,0.04)',
      minHeight: 126,
    }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--brand)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{name}</p>
      <p style={{ marginTop: 10, color: 'var(--text)', fontSize: 13, lineHeight: 1.45 }}>{query}</p>
      <p style={{ marginTop: 12, color: 'var(--text-3)', fontSize: 11 }}>Dashboard: {dashboard}</p>
    </div>
  );
}

function DashboardLink({ grafanaUrl, dashboard }) {
  const href = grafanaUrl && dashboard?.path ? `${grafanaUrl.replace(/\/$/, '')}${dashboard.path}` : grafanaUrl;
  return (
    <a
      href={href || '#'}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'block',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: 18,
        background: 'linear-gradient(135deg, rgba(126,200,122,0.08), rgba(84,160,255,0.05))',
        textDecoration: 'none',
        minHeight: 150,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)', lineHeight: 1 }}>{dashboard.name}</p>
        <span style={{ color: 'var(--brand)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>OPEN ↗</span>
      </div>
      <p style={{ marginTop: 10, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.45 }}>{dashboard.description}</p>
    </a>
  );
}

function AlertRow({ alert }) {
  const critical = alert.severity === 'critical';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.2fr 0.7fr 1fr 1fr',
      gap: 14,
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{alert.name}</span>
      <span style={{
        color: critical ? 'var(--critical)' : 'var(--amber)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
      }}>{alert.severity}</span>
      <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{alert.target}</span>
      <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{alert.action}</span>
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
  const grafana = data?.observability?.grafana;
  const prometheus = data?.observability?.prometheus;
  const alertmanager = data?.observability?.alertmanager;
  const signals = data?.observability?.signals || [];
  const alerts = data?.observability?.alerts || [];
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: 28,
        background: 'radial-gradient(circle at top left, rgba(126,200,122,0.18), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--brand)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>SRE Control Room</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 46, fontWeight: 400, fontStyle: 'italic', color: 'var(--text)', lineHeight: 0.95 }}>Operations & Observability</h1>
            <p style={{ maxWidth: 780, fontSize: 14, color: 'var(--text-2)', marginTop: 12, lineHeight: 1.6 }}>
              A recruiter-friendly view of real operational evidence: service readiness, OpenTelemetry signals, Kubernetes health, Grafana dashboards, Prometheus alerting, and Slack paging routes.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
              {['OpenTelemetry', 'Prometheus', 'Grafana', 'Alertmanager', 'Kubernetes', 'Slack routing'].map(skill => <SkillPill key={skill}>{skill}</SkillPill>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {grafana?.url && (
              <a href={grafana.url} target="_blank" rel="noreferrer" style={{ background: 'var(--brand)', color: '#0c1510', borderRadius: 12, padding: '12px 18px', fontWeight: 800, textDecoration: 'none', fontSize: 13 }}>Open Grafana ↗</a>
            )}
            <button onClick={() => mutate()} style={{ background: 'transparent', color: 'var(--brand)', border: '1px solid var(--border-mid)', borderRadius: 12, padding: '12px 18px', fontWeight: 800, cursor: 'pointer' }}>Refresh</button>
          </div>
        </div>
      </div>

      {isLoading && <Card title="Status"><p style={{ color: 'var(--text-3)' }}>Loading readiness…</p></Card>}
      {error && <Card title="Status"><p style={{ color: 'var(--critical)' }}>Readiness failed: {error.message}</p></Card>}

      {data && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
            <EvidenceTile label="Service readiness" value={data.status} detail={`Backend responded in ${data.latencyMs}ms and DB status is ${data.database.status}.`} />
            <EvidenceTile label="Grafana dashboards" value={grafana?.dashboards?.length || 0} detail="Curated dashboards for SRE overview, infrastructure, alerts, API, AI, and inventory." color="var(--info)" />
            <EvidenceTile label="Alert coverage" value={alerts.length} detail={`${criticalAlerts} critical rules plus warning alerts routed through Alertmanager.`} color="var(--amber)" />
            <EvidenceTile label="Tenant signals" value={data.tenant.inventory.toLocaleString('en-CA')} detail={`${data.tenant.lowStock} low-stock and ${data.tenant.outOfStock} out-of-stock inventory signals.`} />
          </div>

          <Card title="What this proves">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              <SignalCard name="Telemetry" query="App emits OpenTelemetry metrics through OTel Collector into Prometheus." dashboard="API / Inventory / AI" />
              <SignalCard name="Reliability" query="Golden signals track traffic, latency, errors, saturation, and SLO burn." dashboard="SRE Overview" />
              <SignalCard name="Platform" query="Kubernetes readiness, restarts, resource requests, limits, and deployment health." dashboard="Platform Infrastructure" />
              <SignalCard name="Incident response" query="Prometheus rules route to Alertmanager, SRE agent webhook, and Slack receiver." dashboard="Prometheus Alerts" />
            </div>
          </Card>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card title="Runtime">
              <Row label="Environment" value={data.service.env} />
              <Row label="Version" value={data.service.version} />
              <Row label="Node" value={data.deployment.node} />
              <Row label="Uptime" value={`${data.service.uptimeSec}s`} />
              <Row label="Readiness latency" value={`${data.latencyMs}ms`} />
            </Card>

            <Card title="Telemetry Stack">
              <Row label="Collector endpoint" value={data.integrations.otel.endpoint} />
              <Row label="Service name" value={data.integrations.otel.serviceName} />
              <Row label="Exporter" value={data.integrations.otel.status} status />
              <Row label="Database" value={data.database.status} status />
              <Row label="Checked at" value={new Date(data.checkedAt).toLocaleString('en-CA')} />
            </Card>
          </div>

          <Card title="Golden Signals">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              {signals.map(signal => <SignalCard key={signal.name} {...signal} />)}
            </div>
          </Card>

          <Card title="Grafana Dashboards">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
              <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>
                Dashboards are organized by what an SRE would investigate first: service reliability, platform health, alerts, API latency, AI service health, and business inventory risk.
              </p>
              <Status value={grafana?.status} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
              {grafana?.dashboards?.map(dashboard => (
                <DashboardLink key={dashboard.name} grafanaUrl={grafana.url} dashboard={dashboard} />
              ))}
            </div>
          </Card>

          <Card title="Prometheus Alerts → Slack">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
              <Row label="Prometheus" value={prometheus?.status} status />
              <Row label="Alertmanager" value={alertmanager?.status} status />
              <Row label="Slack paging" value={alertmanager?.receivers?.includes('slack') ? 'configured' : 'missing'} status />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.7fr 1fr 1fr', gap: 14, paddingBottom: 8, borderBottom: '1px solid var(--border-mid)' }}>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' }}>Alert</span>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' }}>Severity</span>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' }}>Target</span>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' }}>Route</span>
            </div>
            {alerts.map(alert => <AlertRow key={alert.name} alert={alert} />)}
          </Card>

          <Card title="Integrations">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18 }}>
              <div><Row label="AI service" value={data.integrations.aiService.status} status /><Row label="URL" value={data.integrations.aiService.url} /></div>
              <div><Row label="Anthropic" value={data.integrations.anthropic.status} status /></div>
              <div><Row label="Prometheus" value={prometheus?.url} /><Row label="Alertmanager" value={alertmanager?.url} /></div>
              <div><Row label="Tenant" value={data.tenant.id} /><Row label="Orders" value={data.tenant.orders.toLocaleString('en-CA')} /></div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
