#!/usr/bin/env bash
# scripts/setup.sh — AgriTwin local development setup
#
# Usage:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
#
# What this script does:
#   1. Creates a Python virtual environment in backend/.venv
#   2. Installs all Python dependencies from backend/requirements.txt
#   3. Copies .env.example → .env if .env does not already exist
#   4. Runs npm install inside frontend/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> AgriTwin setup starting from: $REPO_ROOT"

# ── Python backend ──────────────────────────────────────────────────────────
BACKEND_DIR="$REPO_ROOT/backend"
VENV_DIR="$BACKEND_DIR/.venv"

echo ""
echo "[1/4] Creating Python virtual environment at backend/.venv ..."
python3 -m venv "$VENV_DIR"

echo "[2/4] Installing Python dependencies ..."
"$VENV_DIR/bin/pip" install --upgrade pip --quiet
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt" --quiet
echo "      Python dependencies installed."

# ── Environment file ────────────────────────────────────────────────────────
ENV_FILE="$REPO_ROOT/.env"
ENV_EXAMPLE="$REPO_ROOT/.env.example"

echo ""
echo "[3/4] Checking .env file ..."
if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "      Created .env from .env.example — fill in your API keys before running."
else
  echo "      .env already exists — skipping copy."
fi

# ── Node.js frontend ─────────────────────────────────────────────────────────
FRONTEND_DIR="$REPO_ROOT/frontend"

echo ""
echo "[4/4] Installing Node.js frontend dependencies ..."
cd "$FRONTEND_DIR"
npm install --silent
echo "      Node.js dependencies installed."

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "Setup complete!"
echo ""
echo "To start the backend:"
echo "  cd backend"
echo "  source .venv/bin/activate   # On Windows: .venv\\Scripts\\activate"
echo "  uvicorn app.main:app --reload --port \${PORT:-8000}"
echo ""
echo "To start the frontend (in a separate terminal):"
echo "  cd frontend"
echo "  npm run dev"
