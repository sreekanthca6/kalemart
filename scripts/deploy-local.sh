#!/bin/bash
# Full local deployment to OrbStack Kubernetes.
# Run from repo root: ./scripts/deploy-local.sh
# Requires: .env file with ANTHROPIC_API_KEY set
set -euo pipefail

TAG="${1:-dev}"
ENV_FILE="${2:-.env}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_OBSERVABILITY="${SKIP_OBSERVABILITY:-false}"

echo "🚀 Kalemart local deploy → OrbStack k8s (tag: $TAG)"
echo "──────────────────────────────────────────────────────"

# 1. Check kubectl context
CTX=$(kubectl config current-context)
if [[ "$CTX" != "orbstack" ]]; then
  echo "⚠️  kubectl context is '$CTX', expected 'orbstack'"
  echo "   Run: kubectl config use-context orbstack"
  exit 1
fi
echo "✓  kubectl context: $CTX"

# 2. Load ANTHROPIC_API_KEY from .env
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌  $ENV_FILE not found. Copy .env.example → .env and fill in your keys."
  exit 1
fi
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "❌  ANTHROPIC_API_KEY not set in $ENV_FILE"
  exit 1
fi
echo "✓  ANTHROPIC_API_KEY loaded"

# 3. Build images that Helm is about to deploy
if [[ "$SKIP_BUILD" != "true" ]]; then
  echo ""
  echo "🐳 Building app images…"
  ./scripts/build-images.sh "$TAG"
  echo "✓  Images built"
else
  echo "✓  Skipping image build because SKIP_BUILD=true"
fi

# 4. Deploy observability stack
if [[ "$SKIP_OBSERVABILITY" != "true" ]]; then
  echo ""
  echo "📡 Deploying observability stack…"
  helmfile -f observability/helmfile.yaml apply --suppress-diff
  kubectl apply -f observability/grafana-dashboards-configmap.yaml
  echo "✓  Observability stack ready"
else
  echo "✓  Skipping observability because SKIP_OBSERVABILITY=true"
fi

# 5. Deploy kalemart app
echo ""
echo "🌿 Deploying kalemart…"

# Pass the API key + registry via --set so we don't commit it
helm upgrade --install kalemart ./helm/kalemart \
  --namespace kalemart \
  --create-namespace \
  -f helm/kalemart/values.yaml \
  -f helm/kalemart/values.dev.yaml \
  --set global.imageRegistry="" \
  --set global.imagePullPolicy=Never \
  --set "frontend.image.tag=$TAG" \
  --set "backend.image.tag=$TAG" \
  --set "worker.image.tag=$TAG" \
  --set "aiService.image.tag=$TAG" \
  --set "secrets.anthropicApiKey=$ANTHROPIC_API_KEY" \
  --wait --timeout=180s

if [[ "$SKIP_BUILD" != "true" ]]; then
  kubectl rollout restart deployment/kalemart-backend deployment/kalemart-frontend deployment/kalemart-worker deployment/kalemart-ai-service -n kalemart
  kubectl rollout status deploy/kalemart-backend -n kalemart --timeout=120s
  kubectl rollout status deploy/kalemart-frontend -n kalemart --timeout=120s
  kubectl rollout status deploy/kalemart-worker -n kalemart --timeout=120s
  kubectl rollout status deploy/kalemart-ai-service -n kalemart --timeout=120s
fi

echo ""
echo "✅  Kalemart deployed! Check pods:"
echo "    kubectl get pods -n kalemart"
echo ""
echo "Run ./scripts/port-forward.sh to access services locally."
