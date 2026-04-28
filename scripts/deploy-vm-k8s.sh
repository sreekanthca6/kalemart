#!/bin/bash
# Deploy Kalemart to the remote k3s VM using Helm + GHCR images.
# Prereq: scripts/setup-vm-k3s.sh already run on the VM.
# Usage:
#   KUBECONFIG=~/.kube/kalemart-vm.yaml ./scripts/deploy-vm-k8s.sh
#
# Required in .env (repo root):
#   ANTHROPIC_API_KEY, POSTGRES_PASSWORD, JWT_SECRET
#
# Optional (needed only if GHCR packages are private):
#   GHCR_TOKEN — GitHub PAT with read:packages scope
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Load secrets from .env
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

: "${ANTHROPIC_API_KEY:?Missing ANTHROPIC_API_KEY — add it to .env}"
: "${POSTGRES_PASSWORD:?Missing POSTGRES_PASSWORD — add it to .env}"
: "${JWT_SECRET:?Missing JWT_SECRET — add it to .env}"

GHCR_TOKEN="${GHCR_TOKEN:-}"
REGISTRY="ghcr.io/sreekanthca6"

echo "Deploying Kalemart → $(kubectl config current-context 2>/dev/null || echo '(default)')"
echo ""

# ── GHCR pull secret (only needed if packages are private) ───────────────────
if [[ -n "$GHCR_TOKEN" ]]; then
  echo "Creating GHCR imagePullSecret..."
  kubectl create namespace kalemart --dry-run=client -o yaml | kubectl apply -f -
  kubectl create secret docker-registry ghcr-pull-secret \
    --namespace kalemart \
    --docker-server=ghcr.io \
    --docker-username=sreekanthca6 \
    --docker-password="$GHCR_TOKEN" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

# ── Helm deploy ───────────────────────────────────────────────────────────────
helm upgrade --install kalemart ./helm/kalemart \
  --namespace kalemart \
  --create-namespace \
  -f helm/kalemart/values.yaml \
  -f helm/kalemart/values.vm.yaml \
  --set "secrets.anthropicApiKey=$ANTHROPIC_API_KEY" \
  --set "secrets.postgresPassword=$POSTGRES_PASSWORD" \
  --set "secrets.jwtSecret=$JWT_SECRET" \
  ${GHCR_TOKEN:+--set 'global.imagePullSecrets[0]=ghcr-pull-secret'} \
  --wait --timeout=300s

echo ""
echo "✅ Kalemart deployed!"
kubectl get pods -n kalemart
echo ""
VM_IP=$(kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "<VM-IP>")
echo "Add this to /etc/hosts on your Mac:"
echo "  $VM_IP  kalemart.local"
echo ""
echo "Then open: http://kalemart.local"
