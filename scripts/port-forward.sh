#!/bin/bash
# Port-forward all Kalemart + observability services to localhost.
# Run from repo root: ./scripts/port-forward.sh
# Press Ctrl-C to stop all forwards.
set -euo pipefail

cleanup() {
  echo ""
  echo "Stopping all port-forwards…"
  kill $(jobs -p) 2>/dev/null
  wait 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

echo "🔌 Starting port-forwards…"
echo ""

kubectl port-forward -n kalemart     svc/kalemart-frontend   3000:3000 &
kubectl port-forward -n kalemart     svc/kalemart-backend    4000:4000 &
kubectl port-forward -n kalemart     svc/kalemart-ai-service 5000:5000 &
kubectl port-forward -n observability svc/grafana            3001:80   &
kubectl port-forward -n observability svc/prometheus-server  9090:80   &
kubectl port-forward -n observability svc/prometheus-alertmanager 9093:9093 &

sleep 2

echo "┌─────────────────────────────────────────────────────┐"
echo "│  Service           URL                              │"
echo "├─────────────────────────────────────────────────────┤"
echo "│  Frontend          http://localhost:3000            │"
echo "│  Backend API       http://localhost:4000            │"
echo "│  AI Service        http://localhost:5000            │"
echo "│  Grafana           http://localhost:3001            │"
echo "│    login: admin / kalemart-dev                     │"
echo "│  Prometheus        http://localhost:9090            │"
echo "│  Alertmanager      http://localhost:9093            │"
echo "└─────────────────────────────────────────────────────┘"
echo ""
echo "Press Ctrl-C to stop all port-forwards."

wait
