#!/bin/bash
# Bootstrap a fresh Rocky Linux VM with k3s + Helm + nginx-ingress.
# Run from your Mac: ssh rocky@vmh2-sri-02 'bash -s' < scripts/setup-vm-k3s.sh
set -euo pipefail

# ── 1. k3s ────────────────────────────────────────────────────────────────────
if ! command -v k3s &>/dev/null; then
  echo "Installing k3s (traefik disabled — will use nginx ingress)..."
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable=traefik" sh -
fi

echo "Waiting for k3s node to be Ready..."
until sudo /usr/local/bin/kubectl get nodes 2>/dev/null | grep -q ' Ready'; do sleep 3; done

# Make kubectl usable without sudo for the current user
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$USER:$USER" ~/.kube/config
# Replace loopback address with the node's LAN IP so remote kubectl works
NODE_IP=$(hostname -I | awk '{print $1}')
sed -i "s/127.0.0.1/$NODE_IP/g" ~/.kube/config

# ── 2. Helm ───────────────────────────────────────────────────────────────────
if ! command -v helm &>/dev/null; then
  echo "Installing Helm..."
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# ── 3. nginx ingress controller ───────────────────────────────────────────────
echo "Installing nginx ingress controller..."
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.admissionWebhooks.enabled=false \
  --wait --timeout=300s

# ── 4. Firewall (Rocky Linux uses firewalld) ──────────────────────────────────
if command -v firewall-cmd &>/dev/null && sudo systemctl is-active --quiet firewalld 2>/dev/null; then
  echo "Opening ports 80, 443, 6443 in firewalld..."
  sudo firewall-cmd --permanent --add-port=80/tcp
  sudo firewall-cmd --permanent --add-port=443/tcp
  sudo firewall-cmd --permanent --add-port=6443/tcp  # remote kubectl
  sudo firewall-cmd --reload
fi

echo ""
echo "✅ VM is ready for Kalemart deployment!"
echo ""
echo "Node status:"
kubectl get nodes
echo ""
echo "Next — copy the kubeconfig to your Mac, then run deploy-vm-k8s.sh:"
echo "  scp rocky@vmh2-sri-02:~/.kube/config ~/.kube/kalemart-vm.yaml"
echo "  # Edit ~/.kube/kalemart-vm.yaml: replace $NODE_IP with the address"
echo "  # your Mac uses to reach the VM (may be the same)"
echo "  KUBECONFIG=~/.kube/kalemart-vm.yaml ./scripts/deploy-vm-k8s.sh"
