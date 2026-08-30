#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the ATS Hero monorepo.
# - apps/web: Next.js 16 (Node) — installed with npm ci against the committed lockfile.
# - apps/ai:  FastAPI + spaCy (Python 3.12) — installed into a local venv.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# python venv support is not in the default image; add it once (no-op if present).
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends python3.12-venv
fi

# --- apps/web (Node) ---
echo "==> Installing web dependencies (npm ci)"
npm --prefix apps/web ci

# --- apps/ai (Python) ---
echo "==> Installing AI service dependencies (venv + pip)"
if [ ! -x apps/ai/.venv/bin/python ]; then
  python3 -m venv apps/ai/.venv
fi
apps/ai/.venv/bin/python -m pip install --quiet --upgrade pip
# requirements-dev.txt includes requirements.txt plus test deps; the spaCy model
# wheel (en_core_web_sm) is pinned in requirements.txt so no boot-time download.
apps/ai/.venv/bin/python -m pip install --quiet -r apps/ai/requirements-dev.txt

echo "==> Install complete"
