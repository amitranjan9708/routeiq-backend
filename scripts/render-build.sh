#!/usr/bin/env bash
# Render.com build — run from backend/ (Root Directory = backend)
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
  echo "==> Install uv + Google Flights deps"
  if ! command -v uv >/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="${HOME}/.local/bin:${PATH}"
  fi
  cd "$ROOT/vendor/flights-mcp-server"
  uv sync
fi

echo "==> Render build done"
