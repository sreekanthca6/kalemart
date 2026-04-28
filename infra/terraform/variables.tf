variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "project-305939f8-def0-4db0-b42"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-west1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-west1-b"
}

variable "machine_type" {
  description = "GCE machine type for k3s nodes"
  type        = string
  default     = "e2-standard-2"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB per node"
  type        = number
  default     = 50
}

variable "disk_type" {
  description = "Boot disk type"
  type        = string
  default     = "pd-ssd"
}

variable "k3s_version" {
  description = "k3s version to install (passed to Ansible)"
  type        = string
  default     = "v1.31.4+k3s1"
}

variable "ssh_user" {
  description = "SSH user (GCP OS Login format)"
  type        = string
  default     = "sreekanthca6_gmail_com"
}

variable "allowed_ssh_cidrs" {
  description = "CIDRs allowed to SSH into nodes"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default = {
    project     = "kalemart"
    environment = "production"
    managed_by  = "terraform"
  }
}
