#!/bin/bash
# Quick smoke test against a running Kalemart backend.
# Usage: ./scripts/smoke-test.sh [http://localhost:4000]
set -euo pipefail

BASE="${1:-http://localhost:4000}"
PASS=0; FAIL=0

check() {
  local label="$1"; local url="$2"; local method="${3:-GET}"; local body="${4:-}"
  local status
  if [[ -n "$body" ]]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
      -H 'Content-Type: application/json' -d "$body")
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  fi
  if [[ "$status" =~ ^2 ]]; then
    echo "  ✓  $label ($status)"
    ((PASS++))
  else
    echo "  ✗  $label ($status)"
    ((FAIL++))
  fi
}

echo ""
echo "🧪 Kalemart smoke test — $BASE"
echo "──────────────────────────────────────────────────"

echo ""
echo "Health"
check "GET /health"                         "$BASE/health"

echo ""
echo "Inventory"
check "GET /api/inventory"                  "$BASE/api/inventory"
check "GET /api/inventory/low-stock"        "$BASE/api/inventory/low-stock"
check "GET /api/inventory/inv_001"          "$BASE/api/inventory/inv_001"
check "PATCH /api/inventory/inv_001/quantity (restock)" \
  "$BASE/api/inventory/inv_001/quantity" PATCH '{"delta":5,"reason":"smoke-test"}'

echo ""
echo "Products"
check "GET /api/products"                   "$BASE/api/products"
check "GET /api/products?category=beverages" "$BASE/api/products?category=beverages"
check "GET /api/products/prod_001"          "$BASE/api/products/prod_001"

echo ""
echo "Orders"
check "GET /api/orders"                     "$BASE/api/orders"
check "POST /api/orders (create)"           "$BASE/api/orders" POST \
  '{"items":[{"inventoryId":"inv_001","quantity":1}]}'

echo ""
echo "Shopify stubs"
check "POST /api/shopify/webhooks/products" "$BASE/api/shopify/webhooks/products" POST \
  '{"id":99999,"title":"Test Organic Product","product_type":"test","variants":[{"sku":"TEST-001","price":"1.00"}]}'
check "POST /api/shopify/sync/products"     "$BASE/api/shopify/sync/products" POST '{}'

echo ""
echo "──────────────────────────────────────────────────"
echo "  Passed: $PASS  Failed: $FAIL"
[[ $FAIL -eq 0 ]] && echo "  ✅  All checks passed!" || echo "  ❌  Some checks failed."
echo ""
exit $FAIL
