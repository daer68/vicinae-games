#!/usr/bin/env bash
# Builds and installs the Games extension and, unless --no-hide is given,
# the service that hides games from the Vicinae root search.
set -euo pipefail

cd "$(dirname "$0")"

HIDE=1
for arg in "$@"; do
	case "$arg" in
	--no-hide) HIDE=0 ;;
	-h | --help)
		echo "usage: $0 [--no-hide]"
		echo "  --no-hide  install only the Games extension, not the hide-games service"
		exit 0
		;;
	*)
		echo "unknown option: $arg" >&2
		exit 1
		;;
	esac
done

BIN_DIR="$HOME/.local/bin"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SETTINGS="${XDG_CONFIG_HOME:-$HOME/.config}/vicinae/settings.json"

need() { command -v "$1" >/dev/null || { echo "error: '$1' is required but not installed" >&2; exit 1; }; }
need node
need npm
need gio
need vicinae
[ "$HIDE" = 1 ] && need systemctl

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

echo "==> Building and installing the Games extension"
npm run build

[ "$HIDE" = 1 ] || { echo "==> Done (extension only)"; exit 0; }

echo "==> Installing vicinae-hide-games to $BIN_DIR"
install -Dm755 dist/hide-games.js "$BIN_DIR/vicinae-hide-games"

echo "==> Adding hidden-games.json to Vicinae imports"
mkdir -p "$(dirname "$SETTINGS")"
node - "$SETTINGS" <<'EOF'
// settings.json may contain comments, so edit it as text rather than parsing it.
const fs = require("node:fs");
const file = process.argv[2];
const ref = '"./hidden-games.json"';
if (!fs.existsSync(file)) {
	fs.writeFileSync(file, `{\n   "imports": [${ref}]\n}\n`);
	process.exit(0);
}
let text = fs.readFileSync(file, "utf8");
if (text.includes(ref)) process.exit(0);
fs.copyFileSync(file, `${file}.bak`);
const imports = /"imports"\s*:\s*\[/.exec(text);
if (imports) {
	const at = imports.index + imports[0].length;
	const empty = /^\s*\]/.test(text.slice(at));
	text = text.slice(0, at) + ref + (empty ? "" : ", ") + text.slice(at);
} else {
	// Insert right after the first opening brace that is not inside a line comment.
	let offset = 0;
	for (const line of text.split("\n")) {
		const brace = line.indexOf("{");
		if (!line.trimStart().startsWith("//") && brace !== -1) {
			offset += brace + 1;
			break;
		}
		offset += line.length + 1;
	}
	text = `${text.slice(0, offset)}\n   "imports": [${ref}],${text.slice(offset)}`;
}
fs.writeFileSync(file, text);
console.log(`    updated ${file} (backup: ${file}.bak)`);
EOF

echo "==> Installing systemd user units"
install -Dm644 systemd/vicinae-hide-games.service "$UNIT_DIR/vicinae-hide-games.service"
install -Dm644 systemd/vicinae-hide-games.path "$UNIT_DIR/vicinae-hide-games.path"
systemctl --user daemon-reload
systemctl --user enable --now vicinae-hide-games.path vicinae-hide-games.service
journalctl --user -u vicinae-hide-games.service -n 1 --no-pager -o cat || true

echo "==> Done"
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) echo "note: $BIN_DIR is not in PATH; the service still works, but run the tool by full path" ;; esac
