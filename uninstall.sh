#!/usr/bin/env bash
# Removes everything install.sh set up and makes hidden games visible again.
set -euo pipefail

BIN_DIR="$HOME/.local/bin"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
VICINAE_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/vicinae"
EXT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/vicinae/extensions/games"

echo "==> Stopping the hide-games service"
systemctl --user disable --now vicinae-hide-games.path vicinae-hide-games.service 2>/dev/null || true
rm -f "$UNIT_DIR/vicinae-hide-games.path" "$UNIT_DIR/vicinae-hide-games.service"
systemctl --user daemon-reload 2>/dev/null || true

echo "==> Unhiding games"
rm -f "$VICINAE_CONFIG/hidden-games.json" "$BIN_DIR/vicinae-hide-games"
if [ -f "$VICINAE_CONFIG/settings.json" ]; then
	node - "$VICINAE_CONFIG/settings.json" <<'EOF'
const fs = require("node:fs");
const file = process.argv[2];
const text = fs.readFileSync(file, "utf8");
const next = /,\s*"\.\/hidden-games\.json"/.test(text)
	? text.replace(/,\s*"\.\/hidden-games\.json"/, "")
	: text.replace(/"\.\/hidden-games\.json"\s*,?\s*/, "");
if (next !== text) fs.writeFileSync(file, next);
EOF
fi

echo "==> Removing the Games extension"
rm -rf "$EXT_DIR"

echo "==> Done"
