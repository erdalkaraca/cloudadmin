#!/usr/bin/env bash
# Run a command with Node from .nvmrc (Cursor/IDE often prepends an older Node to PATH).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${CLOUDADMIN_NODE:-}"

if [[ -z "$NODE_BIN" && -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  NVM_VERSION="$(tr -d '[:space:]' < "$ROOT/.nvmrc" 2>/dev/null || echo 22)"
  nvm install "$NVM_VERSION" >/dev/null 2>&1 || true
  nvm use "$NVM_VERSION" >/dev/null 2>&1 || true
  NODE_BIN="$(nvm which "$NVM_VERSION" 2>/dev/null || true)"
fi

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "error: Node from .nvmrc not found. Install nvm, then: cd $ROOT && nvm install" >&2
  exit 1
fi

NODE_MAJOR="$("$NODE_BIN" -p "process.versions.node.split('.').map(Number)[0]")"
NODE_MINOR="$("$NODE_BIN" -p "process.versions.node.split('.').map(Number)[1]")"
if [[ "$NODE_MAJOR" -lt 20 ]] || { [[ "$NODE_MAJOR" -eq 20 ]] && [[ "$NODE_MINOR" -lt 19 ]]; }; then
  if [[ "$NODE_MAJOR" -lt 22 ]]; then
    echo "error: Node $("$NODE_BIN" -v) is too old for Vite 8 (need >=20.19 or >=22.12). nvm use in $ROOT" >&2
    exit 1
  fi
fi

export PATH="$(dirname "$NODE_BIN"):$PATH"
cd "$ROOT"
exec "$@"
