output "k3s_server_ip" {
  description = "External IP of the k3s server (control plane)"
  value       = google_compute_address.server.address
}

output "k3s_agent_ip" {
  description = "External IP of the k3s agent (worker)"
  value       = google_compute_address.agent.address
}

output "k3s_server_internal_ip" {
  description = "Internal IP of k3s server (used by agent to join)"
  value       = google_compute_instance.k3s_server.network_interface[0].network_ip
}

output "k3s_api_endpoint" {
  description = "k3s API server URL for kubeconfig"
  value       = "https://${google_compute_address.server.address}:6443"
}

output "ssh_server" {
  description = "SSH command for k3s server"
  value       = "ssh ${var.ssh_user}@${google_compute_address.server.address}"
}

output "ssh_agent" {
  description = "SSH command for k3s agent"
  value       = "ssh ${var.ssh_user}@${google_compute_address.agent.address}"
}
