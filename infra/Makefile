SHELL := /bin/bash
TF_DIR := terraform
ANSIBLE_DIR := ansible
HELM_DIR := ../helm/kalemart
GHCR_USER := sreekanthca6
NAMESPACE  := kalemart

.PHONY: help bootstrap init plan apply destroy ansible-ping ansible-k3s dev-deploy dev-teardown

help:
	@echo ""
	@echo "  bootstrap     Create GCS state bucket (run once)"
	@echo "  init          terraform init"
	@echo "  plan          terraform plan"
	@echo "  apply         terraform apply (provisions VMs)"
	@echo "  destroy       terraform destroy"
	@echo "  ansible-ping  Verify Ansible can reach all nodes"
	@echo "  ansible-k3s   Run k3s install playbook"
	@echo "  dev-deploy    Deploy dev-latest images to OrbStack (local dev cluster)"
	@echo "  dev-teardown  Remove kalemart release from OrbStack"
	@echo ""

bootstrap:
	bash scripts/bootstrap-state.sh

init:
	cd $(TF_DIR) && terraform init

plan:
	cd $(TF_DIR) && terraform plan

apply:
	cd $(TF_DIR) && terraform apply -auto-approve

destroy:
	cd $(TF_DIR) && terraform destroy

ansible-ping:
	cd $(ANSIBLE_DIR) && ansible all -i inventory.ini -m ping

ansible-k3s:
	cd $(ANSIBLE_DIR) && ansible-playbook -i inventory.ini site.yml

ssh-server:
	$(shell cd $(TF_DIR) && terraform output -raw ssh_server)

ssh-agent:
	$(shell cd $(TF_DIR) && terraform output -raw ssh_agent)

# ── Local dev (OrbStack) ──────────────────────────────────────────────────────
# Requires: OrbStack running, kubectl context = orbstack, GHCR_TOKEN env var set
# Usage:    GHCR_TOKEN=<pat> make dev-deploy
#
# Images are pulled from GHCR (dev-latest tag) — push to the dev branch first.

dev-deploy:
	@echo "→ Checking OrbStack context..."
	@kubectl config current-context | grep -q orbstack || \
		(echo "ERROR: kubectl context is not orbstack. Run: kubectl config use-context orbstack" && exit 1)
	@echo "→ Creating namespace..."
	@kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@echo "→ Creating GHCR pull secret..."
	@test -n "$(GHCR_TOKEN)" || (echo "ERROR: GHCR_TOKEN is not set. Export it first." && exit 1)
	@kubectl create secret docker-registry ghcr-pull-secret \
		--namespace=$(NAMESPACE) \
		--docker-server=ghcr.io \
		--docker-username=$(GHCR_USER) \
		--docker-password=$(GHCR_TOKEN) \
		--docker-email=$(GHCR_USER)@gmail.com \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "→ Creating app secrets (reading from env)..."
	@test -n "$(POSTGRES_PASSWORD)" || (echo "ERROR: POSTGRES_PASSWORD not set" && exit 1)
	@test -n "$(JWT_SECRET)"         || (echo "ERROR: JWT_SECRET not set" && exit 1)
	@test -n "$(ANTHROPIC_API_KEY)"  || (echo "ERROR: ANTHROPIC_API_KEY not set" && exit 1)
	@kubectl create secret generic kalemart-secrets \
		--namespace=$(NAMESPACE) \
		--from-literal=POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
		--from-literal=JWT_SECRET=$(JWT_SECRET) \
		--from-literal=ANTHROPIC_API_KEY=$(ANTHROPIC_API_KEY) \
		--from-literal=SLACK_WEBHOOK_URL=$(SLACK_WEBHOOK_URL) \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "→ Deploying kalemart (dev-latest) to OrbStack..."
	@helm upgrade --install kalemart $(HELM_DIR) \
		--namespace=$(NAMESPACE) \
		--values $(HELM_DIR)/values.yaml \
		--values $(HELM_DIR)/values.dev.yaml \
		--set secrets.postgresPassword="$(POSTGRES_PASSWORD)" \
		--set secrets.jwtSecret="$(JWT_SECRET)" \
		--set secrets.anthropicApiKey="$(ANTHROPIC_API_KEY)" \
		--set secrets.slackWebhookUrl="$(SLACK_WEBHOOK_URL)" \
		--wait --timeout=3m
	@echo ""
	@echo "✓ Dev cluster deployed. Pods:"
	@kubectl get pods -n $(NAMESPACE)

dev-teardown:
	@echo "→ Removing kalemart from OrbStack..."
	@helm uninstall kalemart --namespace=$(NAMESPACE) || true
	@kubectl delete namespace $(NAMESPACE) || true
	@echo "✓ Done."
