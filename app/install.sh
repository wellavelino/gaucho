#!/usr/bin/env sh
# Copy the Gaucho popup, the Gaucho badge and the engine into the Herdr desktop app.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
popup=$home/mods/gaucho
badge=$home/mods/gaucho-badge

mkdir -p "$popup" "$badge"
rm -rf "$popup/core"
cp "$root/app/mods/gaucho/main.js" "$root/app/mods/gaucho/mod.json" "$root/app/mods/gaucho/logic.js" "$popup/"
cp -R "$root/core" "$popup/core"
cp "$root/app/mods/gaucho-badge/main.js" "$root/app/mods/gaucho-badge/mod.json" "$badge/"
# The badge ships the same pure logic as the popup.
cp "$root/app/mods/gaucho/logic.js" "$badge/logic.js"

if command -v herdr-app >/dev/null 2>&1; then
  herdr-app check "$popup"
  herdr-app check "$badge"
fi
echo "Installed to $popup and $badge"
