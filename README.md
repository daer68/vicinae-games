# vicinae-games

A [Vicinae](https://vicinae.com) extension that gives your games a launcher of their own, plus an optional service that hides games from the main Vicinae search so they stop crowding out regular apps.

- **Games command:** searches every installed game in one list with its real icon, regardless of where it came from: Steam, Heroic, Lutris, Battle.net, Flatpak or anything else that installs a `.desktop` file.
- **Hide service:** keeps games out of Vicinae's root search and hides new games automatically as you install them. Emulators and launchers such as Steam, Lutris and RetroArch stay in the main list. Games are hidden only in Vicinae; your desktop's app menu is untouched.

## How it works

### Finding games

The extension reads `.desktop` files from the standard XDG application directories (`~/.local/share/applications`, `/usr/share/applications` and the Flatpak export directories). Every entry whose `Categories` include `Game` is listed, sorted into three sections:

| Section | Rule |
| --- | --- |
| **Games** | Everything not matched below |
| **Emulators** | `Categories` includes `Emulator` |
| **Launchers & Tools** | Known launchers (Steam, Heroic, Lutris, Battle.net, Ubisoft Connect, Bottles, ProtonPlus, …) or apps that are also tagged `Utility`, `Network`, `System` and similar |

The launcher list is `TOOL_NAMES` in [`src/lib/entries.ts`](src/lib/entries.ts). Edit it and reinstall if something lands in the wrong section.

Entries marked `NoDisplay=true` are still listed, so games you hid from your desktop menu remain reachable here.

### Launching

Games are started with `gio launch <file.desktop>`. That runs the entry exactly as your desktop would, so Steam, Heroic, Lutris and Flatpak games all launch the usual way.

### Hiding games from the root search

`vicinae-hide-games` writes `~/.config/vicinae/hidden-games.json`, a Vicinae config file that disables the application entry of every game in the **Games** section. Your `settings.json` imports it via `"imports": ["./hidden-games.json"]`, and Vicinae reloads it automatically when it changes.

A systemd user path unit watches the application directories and reruns the tool whenever a `.desktop` file is added, changed or removed. The tool also runs at login. Because your own `settings.json` always takes precedence over imported files, re-enabling a game in Vicinae's settings (**Extensions → Applications**) brings it back to the root search, even while the service is running.

## Requirements

- Vicinae 0.29 or newer
- Node.js 20+ and npm
- `gio` (part of GLib; present on virtually every Linux desktop)
- systemd, for the hide service

## Installation

```bash
git clone https://github.com/daer68/vicinae-games.git
cd vicinae-games
./install.sh
```

The installer:

1. builds the extension and installs it into `~/.local/share/vicinae/extensions/games`
2. installs `vicinae-hide-games` into `~/.local/bin`
3. adds `./hidden-games.json` to the `imports` of `~/.config/vicinae/settings.json` (backing the old file up as `settings.json.bak`)
4. installs and enables `vicinae-hide-games.path` and `vicinae-hide-games.service`, then hides your games once

To install only the Games command and keep games in the root search:

```bash
./install.sh --no-hide
```

Then open Vicinae and search for **Games**. To give it a short alias such as `g`, select it and use **Set alias** (`Ctrl+Shift+E`) from the action panel.

### Updating

```bash
git pull
./install.sh
```

## Usage

### Games command

| Action | Shortcut |
| --- | --- |
| Launch | `Enter` |
| Hide from Games | `Ctrl+H` |
| Show / stop showing hidden items | `Ctrl+Shift+H` |
| Copy desktop file path | from the action panel |

Items hidden inside the Games command are stored by the extension and only affect this list, not the root search.

### vicinae-hide-games

```
vicinae-hide-games            hide all games from the root search
vicinae-hide-games --dry-run  list the games that would be hidden, change nothing
vicinae-hide-games --undo     make every game visible again (until the next run)
```

Check what the service did:

```bash
journalctl --user -u vicinae-hide-games.service -n 5
```

To pause hiding without uninstalling:

```bash
systemctl --user disable --now vicinae-hide-games.path vicinae-hide-games.service
vicinae-hide-games --undo
```

## Uninstallation

```bash
./uninstall.sh
```

This stops and removes the systemd units, deletes `hidden-games.json` and `vicinae-hide-games`, removes the import from `settings.json` and uninstalls the extension. Every game shows up in the root search again.

## Development

```bash
npm install
npm run dev          # live-reload the extension inside Vicinae
npm run build        # build the extension and dist/hide-games.js
```

| Path | Purpose |
| --- | --- |
| `src/games.tsx` | The Games command |
| `src/lib/entries.ts` | Game discovery and classification, shared by both parts |
| `src/hide-games.ts` | Source of `vicinae-hide-games` |
| `systemd/` | User units for the hide service |

## Troubleshooting

- **Games still appear in the root search.** Check that `settings.json` contains `"imports": ["./hidden-games.json"]` and that `vicinae-hide-games --dry-run` lists the game. Then restart Vicinae with `vicinae server`.
- **A game is missing from the Games command.** Its `.desktop` file needs `Categories=Game;`. Some launchers create shortcuts only when asked; in Steam, tick *Create Start menu shortcut* when installing.
- **A launcher shows up as a game.** Add its name in lowercase to `TOOL_NAMES` in `src/lib/entries.ts` and run `./install.sh` again.

## License

[MIT](LICENSE)
