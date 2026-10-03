// Hides games from the Vicinae root search by disabling their application entrypoints
// in an imported config file. Emulators and launchers are left alone.
//
// Usage: vicinae-hide-games [--dry-run] [--undo]

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadEntries } from "./lib/entries";

const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "vicinae");
const OUTPUT = join(CONFIG_DIR, "hidden-games.json");
const IMPORT_REF = "./hidden-games.json";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const undo = args.has("--undo");

const games = undo ? [] : loadEntries().filter((e) => e.kind === "game");
const entrypoints: Record<string, { enabled: false }> = {};
for (const game of games) entrypoints[game.id.replace(/\.desktop$/, "")] = { enabled: false };

const config = { providers: { applications: { entrypoints } } };
const content = `${JSON.stringify(config, null, 3)}\n`;

if (dryRun) {
	for (const game of games) console.log(game.name);
	console.log(`${games.length} games would be hidden`);
	process.exit(0);
}

const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf8") : "";
if (current === content) {
	console.log(`unchanged (${games.length} games hidden)`);
} else {
	// Write atomically so Vicinae's file watcher never reads a partial file.
	writeFileSync(`${OUTPUT}.tmp`, content);
	renameSync(`${OUTPUT}.tmp`, OUTPUT);
	console.log(undo ? "all games unhidden" : `${games.length} games hidden`);
}

const settings = join(CONFIG_DIR, "settings.json");
if (existsSync(settings) && !readFileSync(settings, "utf8").includes(IMPORT_REF)) {
	console.warn(`warning: ${settings} does not import ${IMPORT_REF}; add it to "imports" or nothing will be hidden`);
}
