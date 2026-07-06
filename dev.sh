#!/usr/bin/env bash
#
# Run the MailFlow backend (FastAPI) and frontend (Vite) together.
# Ctrl-C stops both.
#
# Usage:  ./dev.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pick the backend Python: prefer the project venv, fall back to system python3.
if [ -x "$ROOT/backend/.venv/bin/python" ]; then
  PY="$ROOT/backend/.venv/bin/python"
else
  PY="python3"
fi

# Install frontend deps on first run.
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "==> Installing frontend dependencies (first run)..."
  (cd "$ROOT/frontend" && npm install)
fi

pids=()

cleanup() {
  echo ""
  echo "==> Shutting down..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "==> Starting backend  -> http://localhost:8000"
(cd "$ROOT/backend" && "$PY" -m uvicorn main:app --reload --port 8000) &
pids+=($!)

echo "==> Starting frontend -> http://localhost:3000"
(cd "$ROOT/frontend" && npm run dev) &
pids+=($!)

echo "==> Both running. Press Ctrl-C to stop."

# Exit (and trigger cleanup) as soon as either process dies.
wait -n
