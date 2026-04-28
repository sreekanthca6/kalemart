#!/bin/bash
# Run once before terraform init — creates the GCS bucket for remote state.
set -euo pipefail

PROJECT_ID="project-305939f8-def0-4db0-b42"
BUCKET="kalemart-tf-state-1034455127668"
REGION="us-west1"

echo "Creating GCS state bucket: $BUCKET"

gcloud storage buckets create "gs://$BUCKET" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --uniform-bucket-level-access 2>/dev/null || echo "Bucket already exists — continuing."

gcloud storage buckets update "gs://$BUCKET" \
  --versioning

echo "State bucket ready: gs://$BUCKET"
