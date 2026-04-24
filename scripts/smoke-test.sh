#!/bin/bash
# Smoke test a running Kalemart backend or frontend proxy.
# Usage: ./scripts/smoke-test.sh [http://localhost:4000]
set -euo pipefail

BASE="${1:-http://localhost:4000}"
PASS=0
FAIL=0
TOKEN=""
AUTH_PREFIX=""

status_for() {
  local url="$1"; local method="${2:-GET}"; local body="${3:-}"; local auth="${4:-}"
  local args=(-s -o /dev/null -w "%{http_code}" -X "$method" "$url")
  [[ -n "$auth" ]] && args+=(-H "Authorization: Bearer $auth")
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  curl "${args[@]}"
}

body_for() {
  local url="$1"; local method="${2:-GET}"; local body="${3:-}"; local auth="${4:-}"
  local args=(-sS -X "$method" "$url")
  [[ -n "$auth" ]] && args+=(-H "Authorization: Bearer $auth")
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  curl "${args[@]}"
}

pass() {
  echo "  ✓  $1"
  PASS=$((PASS+1))
}

fail() {
  echo "  ✗  $1"
  FAIL=$((FAIL+1))
}

expect_status() {
  local label="$1"; local expected="$2"; local url="$3"; local method="${4:-GET}"; local body="${5:-}"; local auth="${6:-}"
  local status
  status=$(status_for "$url" "$method" "$body" "$auth")
  if [[ "$status" == "$expected" ]]; then
    pass "$label ($status)"
  else
    fail "$label (expected $expected, got $status)"
  fi
}

expect_2xx() {
  local label="$1"; local url="$2"; local method="${3:-GET}"; local body="${4:-}"; local auth="${5:-$TOKEN}"
  local status
  status=$(status_for "$url" "$method" "$body" "$auth")
  if [[ "$status" =~ ^2 ]]; then
    pass "$label ($status)"
  else
    fail "$label ($status)"
  fi
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

auth_prefix() {
  local email="smoke-$(date +%s)-$RANDOM@example.com"
  local body
  body="{\"storeName\":\"Smoke Test Store\",\"email\":\"$email\",\"password\":\"smoke-test-password\"}"

  for prefix in "$BASE/api/auth" "$BASE/auth"; do
    local response token
    response=$(body_for "$prefix/register" POST "$body" "")
    token=$(printf '%s' "$response" | extract_token)
    if [[ -n "$token" ]]; then
      TOKEN="$token"
      AUTH_PREFIX="$prefix"
      return 0
    fi
  done

  return 1
}

echo ""
echo "Kalemart smoke test - $BASE"
echo "--------------------------------------------------"

echo ""
echo "Health"
if [[ "$(status_for "$BASE/health")" =~ ^2 ]]; then
  pass "GET /health"
elif [[ "$(status_for "$BASE/")" =~ ^2 ]]; then
  pass "GET /"
else
  fail "health check via /health or /"
fi

echo ""
echo "Auth boundary"
expect_status "GET /api/inventory without token is blocked" "401" "$BASE/api/inventory"
expect_status "GET /api/products without token is blocked" "401" "$BASE/api/products"
expect_status "GET /api/orders without token is blocked" "401" "$BASE/api/orders"

echo ""
echo "Temporary tenant"
if auth_prefix; then
  pass "register temporary smoke tenant via $AUTH_PREFIX"
else
  fail "register temporary smoke tenant"
fi

echo ""
echo "Authenticated API"
if [[ -n "$TOKEN" ]]; then
  expect_2xx "GET /api/inventory" "$BASE/api/inventory"
  expect_2xx "GET /api/inventory/low-stock" "$BASE/api/inventory/low-stock"
  expect_2xx "GET /api/products" "$BASE/api/products"
  expect_2xx "GET /api/orders" "$BASE/api/orders"
  expect_2xx "GET /api/ops/readiness" "$BASE/api/ops/readiness"
else
  fail "skip authenticated checks because no token was issued"
fi

echo ""
echo "--------------------------------------------------"
echo "  Passed: $PASS  Failed: $FAIL"
[[ $FAIL -eq 0 ]] && echo "  All checks passed." || echo "  Some checks failed."
echo ""
exit "$FAIL"
