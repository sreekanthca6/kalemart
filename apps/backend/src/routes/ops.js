const router = require('express').Router();
const pool = require('../db/pool');
const config = require('../config');
const { queryAsTenant } = require('../db/tenantQuery');

function bool(value) {
  return value ? 'configured' : 'missing';
}

function publicUrl(value, fallback) {
  return value && value.trim() ? value.trim() : fallback;
}

router.get('/readiness', async (req, res, next) => {
  try {
    const started = Date.now();
    const db = await pool.query('SELECT NOW() AS now');
    const [products, inventory, orders, lowStock, outOfStock] = await Promise.all([
      queryAsTenant('SELECT COUNT(*)::int AS count FROM products'),
      queryAsTenant('SELECT COUNT(*)::int AS count FROM inventory'),
      queryAsTenant('SELECT COUNT(*)::int AS count FROM orders'),
      queryAsTenant('SELECT COUNT(*)::int AS count FROM inventory WHERE quantity > 0 AND quantity < min_quantity'),
      queryAsTenant('SELECT COUNT(*)::int AS count FROM inventory WHERE quantity = 0'),
    ]);

    res.json({
      status: 'ready',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      service: {
        name: 'kalemart-backend',
        version: process.env.APP_VERSION || '0.0.1',
        env: config.nodeEnv,
        uptimeSec: Math.round(process.uptime()),
      },
      tenant: {
        id: req.tenantId,
        products: products.rows[0].count,
        inventory: inventory.rows[0].count,
        orders: orders.rows[0].count,
        lowStock: lowStock.rows[0].count,
        outOfStock: outOfStock.rows[0].count,
      },
      database: {
        status: 'ok',
        serverTime: db.rows[0].now,
      },
      integrations: {
        otel: {
          status: bool(process.env.OTEL_EXPORTER_OTLP_ENDPOINT),
          endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || null,
          serviceName: process.env.OTEL_SERVICE_NAME || 'kalemart-backend',
        },
        aiService: {
          status: bool(config.aiServiceUrl),
          url: config.aiServiceUrl,
        },
        anthropic: {
          status: bool(config.anthropicApiKey),
        },
        shopify: {
          shopDomain: config.shopify.shopDomain,
          webhookSecret: config.shopify.webhookSecret === 'dev-secret' ? 'development-secret' : 'configured',
          accessToken: bool(config.shopify.accessToken),
        },
      },
      observability: {
        grafana: {
          status: bool(process.env.GRAFANA_URL),
          url: publicUrl(process.env.GRAFANA_URL, 'http://localhost:3001'),
          dashboards: [
            {
              name: 'SRE Overview',
              description: 'Golden signals, SLO burn, pod health, and active alerts.',
              path: '/d/kalemart-sre-overview/kalemart-sre-overview',
            },
            {
              name: 'Platform Infrastructure',
              description: 'Nodes, pods, CPU, memory, restarts, and Kubernetes saturation.',
              path: '/d/kalemart-platform/kalemart-platform-infrastructure',
            },
            {
              name: 'Prometheus Alerts',
              description: 'Firing and pending alerts grouped by severity, service, and runbook.',
              path: '/d/kalemart-alerts/kalemart-prometheus-alerts',
            },
            {
              name: 'API Latency',
              description: 'Request rate, p50/p95/p99 latency, errors, and trace drill-downs.',
              path: '/d/kalemart-api-latency/kalemart-api-latency',
            },
            {
              name: 'AI Service',
              description: 'AI request rate, latency, errors, and service-level telemetry.',
              path: '/d/kalemart-ai/kalemart-ai-service',
            },
            {
              name: 'Inventory',
              description: 'Business health metrics for product count, low stock, and out-of-stock risk.',
              path: '/d/kalemart-inventory/kalemart-inventory',
            },
          ],
        },
        prometheus: {
          status: bool(process.env.PROMETHEUS_URL),
          url: publicUrl(process.env.PROMETHEUS_URL, 'http://localhost:9090'),
          scrapeInterval: '15s',
          evaluationInterval: '15s',
        },
        alertmanager: {
          status: bool(process.env.ALERTMANAGER_URL),
          url: publicUrl(process.env.ALERTMANAGER_URL, 'http://localhost:9093'),
          receivers: ['sre-agent', 'slack'],
        },
        signals: [
          { name: 'Availability', query: '1 - (5xx / total requests)', dashboard: 'SRE Overview' },
          { name: 'Latency', query: 'p95/p99 from kalemart_http_request_duration_ms_milliseconds', dashboard: 'API Latency' },
          { name: 'Traffic', query: 'sum(rate(kalemart_http_requests_total[5m]))', dashboard: 'SRE Overview' },
          { name: 'Saturation', query: 'container CPU/memory + pod restarts', dashboard: 'Platform Infrastructure' },
        ],
        alerts: [
          { name: 'APIHighLatency', severity: 'warning', target: 'backend', action: 'Slack + SRE Agent' },
          { name: 'TaxAPIHighLatency', severity: 'critical', target: 'backend/tax', action: 'Slack + SRE Agent' },
          { name: 'HighErrorRate', severity: 'critical', target: 'backend', action: 'Slack + SRE Agent' },
          { name: 'PodCrashLooping', severity: 'critical', target: 'kalemart namespace', action: 'Slack + SRE Agent' },
          { name: 'DeploymentUnavailable', severity: 'critical', target: 'kubernetes', action: 'Slack + SRE Agent' },
          { name: 'CloudflaredTunnelDown', severity: 'critical', target: 'edge ingress', action: 'Slack + SRE Agent' },
          { name: 'PodHighCPU / PodHighMemory', severity: 'warning', target: 'platform saturation', action: 'Slack + SRE Agent' },
          { name: 'SLOErrorBudgetFastBurn', severity: 'critical', target: 'availability SLO', action: 'Slack + SRE Agent' },
        ],
      },
      deployment: {
        imageTag: process.env.APP_VERSION || '0.0.1',
        node: process.version,
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
