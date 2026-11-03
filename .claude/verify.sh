#!/usr/bin/env bash
# Repo checks for ~/.claude/hooks/verify.sh: engine tests, then the desktop app's logic tests.
set -euo pipefail
cd "$(dirname "$0")/.."
NODE=${NODE:-$(command -v node)} || { echo "verify: node not found; put it on PATH or set NODE" >&2; exit 1; }
bash tests/run
"$NODE" --test tests/
for f in app/mods/*/main.js app/mods/*/logic.js docs/banner/render.mjs; do "$NODE" --check "$f"; done
sh -n app/install.sh
