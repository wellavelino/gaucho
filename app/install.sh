#!/usr/bin/env sh
# Copy the Gaucho mod and its engine into the Herdr desktop app.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
target=$home/mods/gaucho

mkdir -p "$target"
rm -rf "$target/core"
cp "$root/app/mods/gaucho/main.js" "$root/app/mods/gaucho/mod.json" "$target/"
cp -R "$root/core" "$target/core"

if command -v herdr-app >/dev/null 2>&1; then
  herdr-app check "$target"
fi
echo "Installed to $target"
