# Kalemart — Inventory Management System

Kubernetes-based convenience store inventory management with AI-powered insights.

## Services
| Service | Port | Description |
|---------|------|-------------|
| frontend | 3000 | React/Next.js dashboard |
| backend | 4000 | Node.js REST API |
| worker | — | Background job processor |
| ai-service | 5000 | Python AI service (Claude API) |

## Quick Start
```bash
# Start local cluster via OrbStack, then:
helmfile -f observability/helmfile.yaml apply
helm install kalemart ./helm/kalemart -f helm/kalemart/values.dev.yaml
```
