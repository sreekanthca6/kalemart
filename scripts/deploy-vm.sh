#!/bin/bash
# Deploy Kalemart to a remote Linux VM via rsync + docker compose.
# Usage: ./scripts/deploy-vm.sh [user@host] [remote-dir]
set -euo pipefail

VM_HOST="${1:-rocky@vmh2-sri-02}"
REMOTE_DIR="${2:-/opt/kalemart}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚀 Deploying Kalemart → $VM_HOST:$REMOTE_DIR"
echo "────────────────────────────────────────────"

# ── 1. Sync code ──────────────────────────────────────────────────────────────
echo ""
echo "📦 Syncing code..."
rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.env' \
  "$REPO_ROOT/" "$VM_HOST:$REMOTE_DIR/"

echo "   ✓ Code synced"

# ── 2. Bootstrap & deploy on remote ──────────────────────────────────────────
echo ""
echo "🔧 Bootstrapping remote..."
ssh "$VM_HOST" bash -s -- "$REMOTE_DIR" << 'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"
cd "$REMOTE_DIR"

# Install Docker if missing
if ! command -v docker &>/dev/null; then
  echo "  Installing Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER"
  echo "  ⚠  Added $USER to docker group. Re-login may be needed if this is the first install."
  # Re-exec with sg docker so the rest of the script can use docker
  exec sg docker "$0" "$REMOTE_DIR"
fi

# Install docker compose plugin if missing
if ! docker compose version &>/dev/null 2>&1; then
  echo "  Installing docker compose plugin..."
  sudo dnf install -y docker-compose-plugin 2>/dev/null || \
  sudo yum install -y docker-compose-plugin 2>/dev/null || \
  sudo apt-get install -y docker-compose-plugin 2>/dev/null || true
fi

# Ensure .env exists
if [[ ! -f .env ]]; then
  echo ""
  echo "⚠️  No .env found at $REMOTE_DIR/.env"
  echo "   Create it from the example:"
  echo "     cp $REMOTE_DIR/deploy/.env.example $REMOTE_DIR/.env"
  echo "   Then fill in POSTGRES_PASSWORD, JWT_SECRET, ANTHROPIC_API_KEY"
  exit 1
fi

# Open firewall ports (Rocky/RHEL with firewalld)
if command -v firewall-cmd &>/dev/null && sudo systemctl is-active --quiet firewalld; then
  echo "  Opening firewall port 80..."
  sudo firewall-cmd --permanent --add-port=80/tcp --quiet || true
  sudo firewall-cmd --reload --quiet || true
fi

echo ""
echo "🐳 Building & starting services..."
docker compose pull postgres nginx 2>/dev/null || true
docker compose up --build -d

echo ""
echo "✅ Kalemart is running!"
docker compose ps

VM_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "  → http://$VM_IP"
REMOTE

echo ""
echo "✅ Deployment complete."
