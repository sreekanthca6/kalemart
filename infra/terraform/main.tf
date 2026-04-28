locals {
  name_prefix = "kalemart"
}

# ── APIs ─────────────────────────────────────────────────────────────────────

resource "google_project_service" "compute" {
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

# ── Network ──────────────────────────────────────────────────────────────────

resource "google_compute_network" "vpc" {
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.compute]
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${local.name_prefix}-subnet"
  ip_cidr_range = "10.10.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id

  # Secondary ranges for pod + service CIDRs (k3s uses Flannel by default)
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.20.0.0/16"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.30.0.0/16"
  }
}

# ── Firewall Rules ────────────────────────────────────────────────────────────

# SSH — Ansible needs this
resource "google_compute_firewall" "ssh" {
  name    = "${local.name_prefix}-allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  source_ranges = var.allowed_ssh_cidrs
  target_tags   = ["k3s-node"]
}

# HTTP/HTTPS — Cloudflare tunnel outbound doesn't need 443 open,
# but 80 is needed for the cloudflared → nginx route inside the VM
resource "google_compute_firewall" "http" {
  name    = "${local.name_prefix}-allow-http"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["k3s-node"]
}

# k3s API server — for kubectl from your laptop
resource "google_compute_firewall" "k3s_api" {
  name    = "${local.name_prefix}-allow-k3s-api"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["6443"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["k3s-server"]
}

# Vault UI
resource "google_compute_firewall" "vault" {
  name    = "${local.name_prefix}-allow-vault"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["8200"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["k3s-server"]
}

# Node-to-node: all traffic within the subnet (k3s Flannel VXLAN, etcd, kubelet)
resource "google_compute_firewall" "internal" {
  name    = "${local.name_prefix}-allow-internal"
  network = google_compute_network.vpc.name

  allow { protocol = "tcp" }
  allow { protocol = "udp" }
  allow { protocol = "icmp" }

  source_ranges = [google_compute_subnetwork.subnet.ip_cidr_range]
  target_tags   = ["k3s-node"]
}

# ICMP — useful for debugging
resource "google_compute_firewall" "icmp" {
  name    = "${local.name_prefix}-allow-icmp"
  network = google_compute_network.vpc.name

  allow { protocol = "icmp" }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["k3s-node"]
}

# ── Static External IPs ───────────────────────────────────────────────────────

resource "google_compute_address" "server" {
  name   = "${local.name_prefix}-k3s-server-ip"
  region = var.region
}

resource "google_compute_address" "agent" {
  name   = "${local.name_prefix}-k3s-agent-ip"
  region = var.region
}

# ── Compute Instances ─────────────────────────────────────────────────────────

resource "google_compute_instance" "k3s_server" {
  name         = "${local.name_prefix}-k3s-server"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["k3s-node", "k3s-server"]
  labels       = var.labels

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.disk_size_gb
      type  = var.disk_type
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id
    access_config {
      nat_ip = google_compute_address.server.address
    }
  }

  metadata = {
    # OS Login disabled — Ansible uses a dedicated SSH key injected via metadata.
    # With OS Login off, GCP creates the 'ansible' user from the ssh-keys entry.
    enable-oslogin = "false"
    ssh-keys       = "ansible:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEEyKCh1DV0ZGKexMTVtehTb7lvNIUwKjlHz6GQeunAg ansible-github-actions"
    k3s-role       = "server"
  }

  # Allow the VM to call GCP APIs (for pulling from Artifact Registry etc.)
  service_account {
    scopes = ["cloud-platform"]
  }

  lifecycle {
    # Prevent accidental destroy of the server node
    prevent_destroy = false
  }
}

resource "google_compute_instance" "k3s_agent" {
  name         = "${local.name_prefix}-k3s-agent"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["k3s-node"]
  labels       = var.labels

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.disk_size_gb
      type  = var.disk_type
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id
    access_config {
      nat_ip = google_compute_address.agent.address
    }
  }

  metadata = {
    enable-oslogin = "false"
    ssh-keys       = "ansible:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEEyKCh1DV0ZGKexMTVtehTb7lvNIUwKjlHz6GQeunAg ansible-github-actions"
    k3s-role       = "agent"
  }

  service_account {
    scopes = ["cloud-platform"]
  }
}

# ── Ansible Inventory (generated from Terraform outputs) ──────────────────────

resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../ansible/inventory.ini"
  content  = templatefile("${path.module}/ansible-inventory.tpl", {
    server_ip = google_compute_address.server.address
    agent_ip  = google_compute_address.agent.address
    ssh_user  = var.ssh_user
  })
}
