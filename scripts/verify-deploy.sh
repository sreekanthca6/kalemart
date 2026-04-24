#!/bin/bash
# Verify a freshly deployed Kalemart stack.
# Usage: ./scripts/verify-deploy.sh [frontend-url]
set -euo pipefail

BASE="${1:-http://127.0.0.1:3000}"

echo "Kalemart deploy verification"
echo "--------------------------------------------------"
kubectl rollout status deploy/kalemart-backend -n kalemart --timeout=120s
kubectl rollout status deploy/kalemart-frontend -n kalemart --timeout=120s
kubectl rollout status deploy/kalemart-ai-service -n kalemart --timeout=120s
kubectl rollout status deploy/kalemart-worker -n kalemart --timeout=120s
kubectl get pods -n kalemart
./scripts/smoke-test.sh "$BASE"
