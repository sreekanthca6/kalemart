#!/bin/bash
# Syntax-check project JavaScript sources.
set -euo pipefail

find apps/backend/src apps/worker/src scripts -name '*.js' -print0 |
  while IFS= read -r -d '' file; do
    node --check "$file" >/dev/null
  done

echo "JavaScript syntax OK"
