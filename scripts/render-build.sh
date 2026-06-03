#!/usr/bin/env bash
# Render.com build — run from backend repo root
set -euo pipefail

echo "==> npm install (backend)"
npm install

echo "==> TypeScript compile"
npm run build

ROOT="$(pwd)"

if [ -f "$ROOT/vendor/indian-railways-mcp/package.json" ]; then
  echo "==> Build indian-railways-mcp"
  cd "$ROOT/vendor/indian-railways-mcp"
  npm install
  npm run build
fi

if [ -f "$ROOT/vendor/flights-mcp-server/pyproject.toml" ]; then
  echo "==> Google Flights Python venv (pip)"
  cd "$ROOT/vendor/flights-mcp-server"
  PY="${PYTHON:-python3}"
  if ! "$PY" -c 'import sys; exit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null; then
    for candidate in python3.12 python3.13 python3; do
      if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; exit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null; then
        PY="$candidate"
        break
      fi
    done
  fi
  echo "Using Python: $($PY --version)"
  "$PY" -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q fast-flights httpx 'mcp[cli]'
  .venv/bin/python -c "import fast_flights; print('fast-flights OK')"
fi

echo "==> Render build done"
