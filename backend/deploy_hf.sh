#!/usr/bin/env bash
#
# Deploy the MailFlow backend to a Hugging Face *Docker* Space.
#
# The frontend (mail-flow-kappa.vercel.app) calls
#   https://roshaanawan-mailflow-backend.hf.space
# which HF derives from  <username>-<space>  =>  RoshaanAwan / mailflow-backend.
# So the Space MUST be named exactly that or the URL won't match.
#
# Prereqs (one time):
#   pip install --upgrade "huggingface_hub[cli]"
#   huggingface-cli login          # paste a WRITE token from
#                                   # https://huggingface.co/settings/tokens
#
# Then from the repo:
#   cd backend && ./deploy_hf.sh
#
# After the first push, set the Space SECRETS in the HF dashboard
# (Settings -> Variables and secrets): DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY,
# CORS_ORIGINS, FRONTEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# GOOGLE_REDIRECT_URI.  See README.md for the full list.
set -euo pipefail

SPACE="RoshaanAwan/mailflow-backend"
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Creating the Space (idempotent: ignored if it already exists)..."
huggingface-cli repo create "$SPACE" --repo-type space --space_sdk docker -y || true

echo "==> Uploading the backend folder to $SPACE ..."
# --delete-patterns removes files on the Space that no longer exist locally.
# Secrets and local-only files are excluded so they never land in the repo.
huggingface-cli upload "$SPACE" "$BACKEND_DIR" . \
  --repo-type space \
  --exclude ".venv/*" \
  --exclude "__pycache__/*" \
  --exclude "*.pyc" \
  --exclude ".pytest_cache/*" \
  --exclude ".env" \
  --exclude "firebase_service_account.json" \
  --exclude "mailflow.db" \
  --exclude "*_test.db" \
  --exclude "storage_data.json" \
  --exclude "deploy_hf.sh"

echo ""
echo "==> Done. The Space will build the Dockerfile and come up at:"
echo "    https://roshaanawan-mailflow-backend.hf.space"
echo ""
echo "    If you haven't yet, set the Space SECRETS in the HF dashboard"
echo "    (Settings -> Variables and secrets) — see README.md."
