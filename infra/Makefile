SHELL := /bin/bash
TF_DIR := terraform
ANSIBLE_DIR := ansible

.PHONY: help bootstrap init plan apply destroy ansible-ping ansible-k3s

help:
	@echo ""
	@echo "  bootstrap     Create GCS state bucket (run once)"
	@echo "  init          terraform init"
	@echo "  plan          terraform plan"
	@echo "  apply         terraform apply (provisions VMs)"
	@echo "  destroy       terraform destroy"
	@echo "  ansible-ping  Verify Ansible can reach all nodes"
	@echo "  ansible-k3s   Run k3s install playbook"
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
