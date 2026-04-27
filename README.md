# KaleMart24 — Multi-Tenant Grocery Management Platform

A production-grade, multi-tenant SaaS platform for grocery store chains — built to demonstrate full-stack engineering, Kubernetes operations, observability, and autonomous SRE practices.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes (OrbStack)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Next.js  │  │ Node.js  │  │  Python  │  │  SRE Agent    │  │
│  │ Frontend │→ │ Backend  │→ │ AI Svc   │  │  (FastAPI +   │  │
│  │ :3000    │  │ :4000    │  │ :5000    │  │   Claude API) │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
│       │              │              │               ↑            │
│       └──────────────┴──────────────┘        Alertmanager       │
│                      │                             │             │
│               ┌──────────────┐         ┌───────────────────┐   │
│               │  PostgreSQL  │         │    Prometheus +    │   │
│               │  (RLS + RBM) │         │  Grafana + Tempo   │   │
│               └──────────────┘         └───────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### Multi-Tenancy
- PostgreSQL Row-Level Security (RLS) isolates data per tenant at the DB layer
- Composite indexes `(tenant_id, created_at)` with explicit query params for optimal planner stats
- `SET LOCAL random_page_cost = 1.1` per transaction — corrects PostgreSQL's cost model for SSD storage
- Tax period queries: **145–255 ms** (down from 22,000 ms before RLS-aware index tuning)

### AI Supervisor
- Claude-powered inventory analysis (`/api/supervisor/analyze`)
- Identifies low-stock, reorder recommendations, and sales velocity trends
- Mode falls back gracefully: `claude → rule-based → demo`

### Autonomous SRE Agent
The centrepiece for SRE showcase. A Claude-powered agent that acts as an on-call SRE:

```
Prometheus alert fires
        ↓
  Alertmanager webhook → SRE Agent (FastAPI)
        ↓
  Claude investigates using tools:
    • query_prometheus   — fetch metrics
    • get_pod_logs       — stream k8s logs
    • get_k8s_events     — cluster events
    • run_db_diagnostic  — EXPLAIN ANALYZE (read-only guard)
    • restart_deployment — needs human approval
    • create_db_index    — needs human approval
        ↓
  Slack notification with Approve / Reject / Don't-ask-again links
        ↓
  Fix applied → metrics re-validated → RCA posted to Slack
```

**Approval flow:** Uses `asyncio.Event` shared between the background investigation task and the HTTP `/approve/{id}` endpoint. Zero polling — the task suspends until the human clicks a link.

**Don't-ask-again:** Approved action types are persisted so repeated incidents self-heal without paging the engineer.

### Observability Stack
- **Prometheus** — scrapes backend, AI service, and OTel Collector metrics
- **Tempo** — distributed traces via OTel SDK (Node.js + Python)
- **Alert rules** — 10 rules across 5 groups: latency, errors, pods, DB, SLO burn rate
- **SLO burn rate alerts** — fast-burn (1h window, 10× budget) fires in ≤ 5 minutes

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Node.js, Express, OpenTelemetry |
| AI Service | Python, FastAPI, Anthropic SDK |
| SRE Agent | Python, FastAPI, Anthropic Claude claude-sonnet-4-6 |
| Database | PostgreSQL 15, Row-Level Security |
| Infra | Kubernetes, Helm, Docker |
| Observability | Prometheus, Alertmanager, Grafana, Tempo, OTel Collector |
| CI/CD | GitHub Actions — build & push multi-service images |

## SRE Practices Demonstrated

- **SLO / Error Budget** — `/api` 99.5% availability SLO with burn rate alerting
- **Agentic incident response** — LLM-driven investigate → diagnose → fix → validate loop
- **Human-in-the-loop** — destructive actions require approval; safe reads run automatically
- **Toil reduction** — "don't ask again" auto-approves repeated safe remediations
- **Query performance tuning** — EXPLAIN ANALYZE, composite indexes, cost model correction
- **Distributed tracing** — trace IDs flow from frontend → backend → AI service
- **Chaos-ready** — manual trigger endpoint (`POST /trigger`) injects synthetic alerts for demos

## Quick Start (Local Kubernetes)

### Prerequisites
- [OrbStack](https://orbstack.dev) or any Kubernetes (kind, minikube)
- `kubectl`, `helm`, `docker`

### 1. Clone & configure
```bash
git clone https://github.com/sreekanthca6/kalemart.git
cd kalemart
cp .env.example .env
# Fill in .env — at minimum: ANTHROPIC_API_KEY, PGPASSWORD, JWT_SECRET
```

### 2. Build images
```bash
docker build -t kalemart/backend:latest    ./apps/backend
docker build -t kalemart/frontend:latest   ./apps/frontend
docker build -t kalemart/ai-service:latest ./apps/ai-service
docker build -t kalemart/sre-agent:latest  ./apps/sre-agent
```

### 3. Deploy
```bash
helm install kalemart ./helm/kalemart \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set secrets.postgresPassword="$PGPASSWORD" \
  --set secrets.jwtSecret="$JWT_SECRET" \
  --set secrets.slackWebhookUrl="$SLACK_WEBHOOK_URL"
```

### 4. Install observability stack
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/prometheus \
  -n observability --create-namespace \
  -f observability/prometheus-values.yaml

kubectl apply -f observability/alert-rules.yaml
```

### 5. Port-forward & explore
```bash
kubectl port-forward svc/kalemart-frontend 3000:3000 -n kalemart &
kubectl port-forward svc/kalemart-sre-agent 8888:8080 -n kalemart &
# Open http://localhost:3000
```

### 6. Trigger a demo incident
```bash
curl -X POST http://localhost:8888/trigger \
  -H "Content-Type: application/json" \
  -d '{"alertname":"TaxAPIHighLatency","severity":"warning","summary":"p99 tax latency > 500ms"}'
# Watch Slack — the agent investigates and posts an RCA
```

## Project Structure

```
kalemart/
├── apps/
│   ├── backend/          # Node.js/Express API
│   ├── frontend/         # Next.js dashboard
│   ├── ai-service/       # Python FastAPI — Claude AI supervisor
│   └── sre-agent/        # Python FastAPI — autonomous SRE agent
├── helm/kalemart/        # Helm chart for all services
├── observability/
│   ├── prometheus-values.yaml
│   └── alert-rules.yaml  # 10 Prometheus alert rules
├── scripts/              # DB seed & Shopify import
└── .github/workflows/    # CI — build & push images
```

## CI/CD

GitHub Actions builds and pushes all 4 Docker images on every push to `main`. See `.github/workflows/`.

## License

MIT
