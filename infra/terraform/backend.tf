terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }

  # Run infra/scripts/bootstrap-state.sh once before terraform init
  backend "gcs" {
    bucket = "kalemart-tf-state-1034455127668"
    prefix = "infra/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}
