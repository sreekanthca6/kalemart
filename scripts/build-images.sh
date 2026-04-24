#!/bin/bash
# Build all Kalemart Docker images for OrbStack's local Docker runtime.
# Run from the repo root: ./scripts/build-images.sh
set -euo pipefail

TAG="${1:-dev}"
PUSH_REGISTRY="${PUSH_REGISTRY:-}"

if [[ -n "$PUSH_REGISTRY" ]]; then
  IMAGE_PREFIX="$PUSH_REGISTRY/kalemart"
else
  IMAGE_PREFIX="kalemart"
fi

echo "🐳 Building Kalemart images → $IMAGE_PREFIX (tag: $TAG)"
echo "──────────────────────────────────────────────────────"

services=("backend" "frontend" "worker" "ai-service")

for svc in "${services[@]}"; do
  echo ""
  echo "▶ $svc"
  docker build \
    --platform linux/arm64 \
    -t "$IMAGE_PREFIX/$svc:$TAG" \
    "apps/$svc/"
  if [[ -n "$PUSH_REGISTRY" ]]; then
    echo "  pushing…"
    docker push "$IMAGE_PREFIX/$svc:$TAG"
  fi
  echo "  ✓ $IMAGE_PREFIX/$svc:$TAG"
done

echo ""
echo "✅  All images built. Verify with:"
echo "    docker images | grep $IMAGE_PREFIX"
