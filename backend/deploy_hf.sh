#!/usr/bin/env bash
#
# Deploy the MailFlow backend to a Hugging Face *Docker* Space.
#
# The frontend (mail-flow-kappa.vercel.app) calls
#   https://roshaanawan-mailflow-backend.hf.space
# which HF derives from  <username>-<space>  =>  RoshaanAwan / mailflow-backend.
# So the Space MUST be named exactly that or the URL won't match.
#
# Uses the `hf` CLI from the backend venv (huggingface_hub >= 1.x). If it's not
# installed yet:  ./.venv/bin/pip install --upgrade "huggingface_hub[cli]"
#
# One-time login (paste a WRITE token from huggingface.co/settings/tokens):
#   ./.venv/bin/hf auth login
# ...or set HF_TOKEN in your environment before running this script.
#
# Then:  cd backend && ./deploy_hf.sh
#
# After the first push, set the Space SECRETS in the HF dashboard
# (Settings -> Variables and secrets): DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY,
# CORS_ORIGINS, FRONTEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# GOOGLE_REDIRECT_URI.  See README.md for the full list.
set -euo pipefail

SPACE="RoshaanAwan/mailflow-backend"
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Prefer the venv's hf; fall back to one on PATH.
if [ -x "$BACKEND_DIR/.venv/bin/hf" ]; then
  HF="$BACKEND_DIR/.venv/bin/hf"
else
  HF="hf"
fi

echo "==> Using: $HF ($($HF --version))"

echo "==> Creating the Space (idempotent — --exist-ok ignores an existing one)..."
"$HF" repos create "$SPACE" --type space --space-sdk docker --exist-ok

echo "==> Uploading the backend folder to $SPACE ..."
# Secrets and local-only files are excluded so they never land in the repo.
"$HF" upload "$SPACE" "$BACKEND_DIR" . \
  --repo-type space \
  --exclude ".venv/**" \
  --exclude "__pycache__/**" \
  --exclude "*.pyc" \
  --exclude ".pytest_cache/**" \
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
