#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://kalemart.sreekanthp.com}"
GRAFANA_URL="${GRAFANA_URL:-https://grafana.sreekanthp.com}"
DEMO_EMAIL="${DEMO_EMAIL:-demo@kalemart.local}"
DEMO_PASSWORD="${DEMO_PASSWORD:-kalemart-demo}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

pass=0
fail=0

ok() {
  printf 'ok - %s\n' "$1"
  pass=$((pass + 1))
}

not_ok() {
  printf 'not ok - %s\n' "$1" >&2
  fail=$((fail + 1))
}

check_http() {
  local name="$1"
  local url="$2"
  if curl -fsSIL --max-time 20 "$url" >/dev/null; then
    ok "$name"
  else
    not_ok "$name"
  fi
}

check_body_contains() {
  local name="$1"
  local file="$2"
  local marker="$3"
  if grep -Fq "$marker" "$file"; then
    ok "$name"
  else
    not_ok "$name"
  fi
}

check_http "frontend root responds" "$APP_URL/"

if curl -fsSL --max-time 20 "$APP_URL/ops" -o "$tmpdir/ops.html"; then
  ok "ops page responds"
  check_body_contains "ops page shows SRE Control Room" "$tmpdir/ops.html" "SRE Control Room"
  check_body_contains "ops page mentions Grafana" "$tmpdir/ops.html" "Grafana"
  check_body_contains "ops page mentions Prometheus" "$tmpdir/ops.html" "Prometheus"
else
  not_ok "ops page responds"
fi

login_status="$(
  curl -sS --max-time 20 \
    -X POST "$APP_URL/api/auth/login" \
    -H 'content-type: application/json' \
    --data "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}" \
    -o "$tmpdir/login.json" \
    -w '%{http_code}' || true
)"

if [[ "$login_status" == "200" ]]; then
  ok "demo login returns 200"
else
  not_ok "demo login returns 200 (got $login_status)"
fi

token="$(
  python3 - "$tmpdir/login.json" <<'PY'
import json
import sys

try:
    with open(sys.argv[1]) as fh:
        print(json.load(fh).get("token", ""))
except Exception:
    print("")
PY
)"

if [[ -n "$token" ]]; then
  ok "demo login returns token"
else
  not_ok "demo login returns token"
fi

inventory_status="$(
  curl -sS --max-time 20 \
    -H "Authorization: Bearer $token" \
    "$APP_URL/api/inventory" \
    -o "$tmpdir/inventory.json" \
    -w '%{http_code}' || true
)"

if [[ "$inventory_status" == "200" ]]; then
  ok "authenticated inventory returns 200"
else
  not_ok "authenticated inventory returns 200 (got $inventory_status)"
fi

inventory_count="$(
  python3 - "$tmpdir/inventory.json" <<'PY'
import json
import sys

try:
    with open(sys.argv[1]) as fh:
        data = json.load(fh)
    print(len(data) if isinstance(data, list) else 0)
except Exception:
    print(0)
PY
)"

if [[ "$inventory_count" -gt 0 ]]; then
  ok "authenticated inventory has records"
else
  not_ok "authenticated inventory has records"
fi

grafana_status="$(
  curl -sS --max-time 20 \
    "$GRAFANA_URL/api/health" \
    -o "$tmpdir/grafana-health.json" \
    -w '%{http_code}' || true
)"

if [[ "$grafana_status" == "200" ]]; then
  ok "public Grafana health returns 200"
else
  not_ok "public Grafana health returns 200 (got $grafana_status)"
fi

grafana_db="$(
  python3 - "$tmpdir/grafana-health.json" <<'PY'
import json
import sys

try:
    with open(sys.argv[1]) as fh:
        print(json.load(fh).get("database", ""))
except Exception:
    print("")
PY
)"

if [[ "$grafana_db" == "ok" ]]; then
  ok "public Grafana database health is ok"
else
  not_ok "public Grafana database health is ok"
fi

printf '\nPassed: %d Failed: %d\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
