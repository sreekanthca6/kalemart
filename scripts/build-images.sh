#!/bin/bash
# Build all Kalemart Docker images and push to OrbStack's local registry.
# Run from the repo root: ./scripts/build-images.sh
set -euo pipefail

REGISTRY="registry.orbstack.internal/kalemart"
TAG="${1:-dev}"

echo "🐳 Building Kalemart images → $REGISTRY (tag: $TAG)"
echo "──────────────────────────────────────────────────────"

services=("backend" "frontend" "worker" "ai-service")

for svc in "${services[@]}"; do
  echo ""
  echo "▶ $svc"
  docker build \
    --platform linux/arm64 \
    -t "$REGISTRY/$svc:$TAG" \
    "apps/$svc/"
  echo "  pushing…"
  docker push "$REGISTRY/$svc:$TAG"
  echo "  ✓ $REGISTRY/$svc:$TAG"
done

echo ""
echo "✅  All images pushed. Verify with:"
echo "    docker images | grep $REGISTRY"
