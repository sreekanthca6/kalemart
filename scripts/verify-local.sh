#!/bin/bash
# Verify the local OrbStack dev deployment and the recruiter-facing Ops/Grafana flow.
# Run after:
#   ./scripts/deploy-local.sh dev
#   ./scripts/port-forward.sh
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-kalemart-dev}"
TOKEN=""

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

http_code() {
  curl -s -o /dev/null -w '%{http_code}' "$1" || true
}

extract_token() {
  node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try { process.stdout.write(JSON.parse(input).token || ""); }
      catch { process.stdout.write(""); }
    });
  '
}

json_values_matching() {
  local prefix="$1"
  node -e '
    const prefix = process.argv[1];
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input).data || [];
        for (const value of data) {
          if (typeof value === "string" && value.startsWith(prefix)) console.log(value);
        }
      } catch {}
    });
  ' "$prefix"
}

json_dashboard_titles() {
  node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input);
        for (const item of data) {
          if (item.type === "dash-db" && item.title) console.log(item.title);
        }
      } catch {}
    });
  '
}

grafana_prometheus_proxy_works() {
  curl -fsSL -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
    -H "Content-Type: application/json" \
    "$GRAFANA_URL/api/ds/query" \
    -d '{"queries":[{"refId":"A","datasource":{"type":"prometheus","uid":"prometheus"},"expr":"sum(kalemart_http_requests_total)","instant":true,"range":false,"intervalMs":15000,"maxDataPoints":100}],"from":"now-5m","to":"now"}' \
    | node -e '
      let input = "";
      process.stdin.on("data", chunk => input += chunk);
      process.stdin.on("end", () => {
        try {
          const result = JSON.parse(input).results?.A;
          if (result?.error) process.exit(1);
          const frames = result?.frames || [];
          process.exit(frames.length > 0 ? 0 : 1);
        } catch {
          process.exit(1);
        }
      });
    '
}

create_smoke_token() {
  local email="verify-local-$(date +%s)-$RANDOM@example.com"
  local body response
  body="{\"storeName\":\"Verify Local Store\",\"email\":\"$email\",\"password\":\"verify-local-password\"}"
  response="$(curl -sS -X POST "$BACKEND_URL/auth/register" -H "Content-Type: application/json" -d "$body" || true)"
  TOKEN="$(printf '%s' "$response" | extract_token)"
  [[ -n "$TOKEN" ]]
}

require_2xx() {
  local label="$1"
  local url="$2"
  local code
  code="$(http_code "$url")"
  if [[ "$code" =~ ^2 ]]; then
    pass "$label ($code)"
  else
    fail "$label (got $code) — check port-forward or pod health"
  fi
}

echo "Kalemart local verification"
echo "────────────────────────────"

echo ""
echo "1. Cluster context"
ctx="$(kubectl config current-context 2>/dev/null || true)"
if [[ "$ctx" == "orbstack" ]]; then
  pass "kubectl context is orbstack"
else
  fail "kubectl context is '$ctx' (expected orbstack)"
fi

echo ""
echo "2. Kubernetes rollouts"
for deploy in kalemart-backend kalemart-frontend kalemart-ai-service kalemart-worker; do
  if kubectl rollout status "deploy/$deploy" -n kalemart --timeout=10s >/dev/null 2>&1; then
    pass "$deploy rollout complete"
  else
    fail "$deploy rollout not ready"
  fi
done

echo ""
echo "3. Local image policy"
deployed="$(kubectl get deploy -n kalemart -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[*].image}{"\t"}{.spec.template.spec.containers[*].imagePullPolicy}{"\n"}{end}')"
printf '%s\n' "$deployed"
if printf '%s\n' "$deployed" | grep -q $'kalemart-frontend\tkalemart/frontend:dev\tNever'; then
  pass "frontend uses rebuilt local image"
else
  fail "frontend is not using kalemart/frontend:dev with pullPolicy Never"
fi
if printf '%s\n' "$deployed" | grep -q $'kalemart-backend\tkalemart/backend:dev\tNever'; then
  pass "backend uses rebuilt local image"
else
  fail "backend is not using kalemart/backend:dev with pullPolicy Never"
fi

echo ""
echo "4. Local HTTP endpoints"
require_2xx "frontend /ops" "$FRONTEND_URL/ops"
require_2xx "backend /health" "$BACKEND_URL/health"
require_2xx "Grafana login page" "$GRAFANA_URL/login"
require_2xx "Prometheus readiness" "$PROMETHEUS_URL/-/ready"
require_2xx "Alertmanager readiness" "$ALERTMANAGER_URL/-/ready"

echo ""
echo "5. Ops page content"
ops_html="$(mktemp)"
if curl -fsSL "$FRONTEND_URL/ops" -o "$ops_html"; then
  if grep -q 'Operations &amp; Observability' "$ops_html" && grep -q 'SRE Control Room' "$ops_html"; then
    pass "Ops page is the new observability UI"
  else
    fail "Ops page loaded but does not contain new observability markers"
  fi
else
  fail "could not fetch Ops page"
fi
rm -f "$ops_html"

echo ""
echo "6. Grafana authentication"
grafana_user_json="$(mktemp)"
grafana_code="$(curl -s -o "$grafana_user_json" -w '%{http_code}' -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/user" || true)"
if [[ "$grafana_code" == "200" ]] && grep -q '"isGrafanaAdmin":true' "$grafana_user_json"; then
  pass "Grafana admin login works ($GRAFANA_USER / $GRAFANA_PASSWORD)"
else
  fail "Grafana login failed — reset with: kubectl exec -n observability deploy/grafana -- grafana cli admin reset-admin-password kalemart-dev"
fi
rm -f "$grafana_user_json"

echo ""
echo "7. Backend observability metadata"
readiness_json="$(mktemp)"
if create_smoke_token && curl -fsSL "$BACKEND_URL/api/ops/readiness" -H "Authorization: Bearer $TOKEN" -o "$readiness_json"; then
  if grep -q '"grafana"' "$readiness_json" && grep -q 'localhost:3001' "$readiness_json"; then
    pass "backend exposes local Grafana metadata"
  else
    fail "backend readiness is missing local Grafana metadata"
  fi
else
  fail "could not fetch authenticated backend /api/ops/readiness"
fi
rm -f "$readiness_json"

echo ""
echo "8. Grafana dashboards"
dashboards_json="$(mktemp)"
if curl -fsSL -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/search?query=Kalemart" -o "$dashboards_json"; then
  dashboard_titles="$(cat "$dashboards_json" | json_dashboard_titles)"
  for title in \
    "Kalemart — SRE Overview" \
    "Kalemart — Platform Infrastructure" \
    "Kalemart — Prometheus Alerts" \
    "Kalemart — API Latency" \
    "Kalemart — AI Service" \
    "Kalemart — Inventory"; do
    if printf '%s\n' "$dashboard_titles" | grep -Fxq "$title"; then
      pass "Grafana dashboard loaded: $title"
    else
      fail "Grafana dashboard missing: $title"
    fi
  done
else
  fail "could not query Grafana dashboards"
fi
rm -f "$dashboards_json"

echo ""
echo "9. Real Prometheus metrics"
for i in {1..10}; do
  curl -s -o /dev/null "$BACKEND_URL/health" || true
  curl -s -o /dev/null "$BACKEND_URL/api/products" || true
  curl -s -o /dev/null "$FRONTEND_URL/ops" || true
done
metrics_json="$(mktemp)"
if curl -fsSL "$PROMETHEUS_URL/api/v1/label/__name__/values" -o "$metrics_json"; then
  kalemart_metrics="$(cat "$metrics_json" | json_values_matching "kalemart_")"
  if printf '%s\n' "$kalemart_metrics" | grep -Fxq "kalemart_http_requests_total"; then
    pass "Prometheus has real backend request metrics"
  else
    fail "Prometheus is missing kalemart_http_requests_total"
  fi
  if printf '%s\n' "$kalemart_metrics" | grep -Fxq "kalemart_http_request_duration_ms_milliseconds_bucket"; then
    pass "Prometheus has real backend latency histogram metrics"
  else
    fail "Prometheus is missing kalemart_http_request_duration_ms_milliseconds_bucket"
  fi
  if printf '%s\n' "$kalemart_metrics" | grep -Fxq "kalemart_inventory_products_total"; then
    pass "Prometheus has real inventory business metrics"
  else
    fail "Prometheus is missing kalemart_inventory_products_total"
  fi
else
  fail "could not query Prometheus metric names"
fi
rm -f "$metrics_json"

echo ""
echo "10. Grafana can query Prometheus"
if curl -fsSL -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/datasources/uid/prometheus/health" | grep -q '"status":"OK"'; then
  pass "Grafana Prometheus datasource health is OK"
else
  fail "Grafana Prometheus datasource health failed"
fi
if curl -fsSL -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/datasources/uid/tempo/health" | grep -q '"status":"OK"'; then
  pass "Grafana Tempo datasource health is OK"
else
  fail "Grafana Tempo datasource health failed"
fi
if curl -fsSL -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/datasources/uid/loki/health" | grep -q '"status":"OK"'; then
  pass "Grafana Loki datasource health is OK"
else
  fail "Grafana Loki datasource health failed"
fi
if grafana_prometheus_proxy_works; then
  pass "Grafana dashboard queries can read Kalemart metrics"
else
  fail "Grafana dashboard query proxy cannot read Kalemart metrics"
fi

echo ""
echo "────────────────────────────"
echo "Passed: $PASS  Failed: $FAIL"
if [[ "$FAIL" -eq 0 ]]; then
  echo "Local dev deployment is ready."
else
  echo "Local dev deployment needs attention."
fi
exit "$FAIL"
