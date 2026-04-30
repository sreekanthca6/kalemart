# Kalemart Agent Instructions

Read this before making code, deployment, or verification changes.

## Local development is Kubernetes-first

Kalemart local development runs on **OrbStack Kubernetes**, not Docker Compose.

Before any local deploy, test, verification, port-forward, observability, Grafana, Prometheus, Alertmanager, Helm, or Kubernetes work, read:

```txt
docs/DEV_PROD_WORKFLOW.md
```

That document is the source of truth for:

- local OrbStack context and namespaces
- required Docker socket
- local deploy command
- port-forward URLs
- Grafana credentials
- verification script
- production GitOps workflow

## Required local deploy/test sequence

Use this exact flow unless the user explicitly asks for a different path:

```bash
cd /Users/sreekanth/work/kalemart
export DOCKER_HOST=unix:///Users/sreekanth/.orbstack/run/docker.sock
kubectl config use-context orbstack
./scripts/deploy-local.sh dev
./scripts/port-forward.sh
./scripts/verify-local.sh
```

Do not claim local deployment success until:

```bash
./scripts/verify-local.sh
```

passes.

## Important rules

- Do **not** use `docker-compose` for local testing; it is legacy.
- Do **not** use production Argo CD for local testing.
- `localhost:3000` is the KaleMart frontend.
- `localhost:3001` is Grafana.
- Grafana local login is `admin / kalemart-dev`.
- If Docker cannot connect, set `DOCKER_HOST=unix:///Users/sreekanth/.orbstack/run/docker.sock`.
- If Grafana login fails locally, reset it with:

```bash
kubectl exec -n observability deploy/grafana -- grafana cli admin reset-admin-password kalemart-dev
```
