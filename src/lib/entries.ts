import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Kind = "game" | "emulator" | "tool";
export type Entry = { id: string; path: string; name: string; icon?: string; kind: Kind };

// Apps tagged "Game" that are launchers or utilities rather than games.
const TOOL_NAMES = new Set([
	"alvr launcher",
	"battle.net",
	"bottles",
	"dualsenseclient",
	"faugus",
	"goverlay",
	"heroic games launcher",
	"lutris",
	"pegasus",
	"protonplus",
	"steam",
	"steamvr",
	"ubisoft connect",
	"vrmonitor",
]);
const TOOL_CATEGORIES = ["Utility", "Network", "PackageManager", "Graphics", "System", "Settings", "Development"];

export const SECTIONS: { kind: Kind; title: string }[] = [
	{ kind: "game", title: "Games" },
	{ kind: "emulator", title: "Emulators" },
	{ kind: "tool", title: "Launchers & Tools" },
];

function applicationDirs(): string[] {
	const dataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
	const dataDirs = (process.env.XDG_DATA_DIRS || "").split(":").filter(Boolean);
	const defaults = [
		join(homedir(), ".local/share/flatpak/exports/share"),
		"/var/lib/flatpak/exports/share",
		"/usr/local/share",
		"/usr/share",
	];
	// Earlier directories take precedence, matching the XDG lookup order.
	return [...new Set([dataHome, ...dataDirs, ...defaults])].map((d) => join(d, "applications"));
}

function parseDesktopEntry(text: string): Record<string, string> {
	const fields: Record<string, string> = {};
	let inMain = false;
	for (const line of text.split("\n")) {
		if (line.startsWith("[")) {
			inMain = line.trim() === "[Desktop Entry]";
			continue;
		}
		if (!inMain) continue;
		const eq = line.indexOf("=");
		if (eq > 0) fields[line.slice(0, eq).trim()] ??= line.slice(eq + 1).trim();
	}
	return fields;
}

function classify(name: string, categories: string[]): Kind {
	if (categories.includes("Emulator")) return "emulator";
	if (TOOL_NAMES.has(name.toLowerCase())) return "tool";
	if (categories.some((c) => TOOL_CATEGORIES.includes(c))) return "tool";
	return "game";
}

export function loadEntries(): Entry[] {
	const seen = new Set<string>();
	const entries: Entry[] = [];
	for (const dir of applicationDirs()) {
		let files: string[];
		try {
			files = readdirSync(dir);
		} catch {
			continue;
		}
		for (const file of files) {
			if (!file.endsWith(".desktop") || seen.has(file)) continue;
			seen.add(file);
			const path = join(dir, file);
			let fields: Record<string, string>;
			try {
				fields = parseDesktopEntry(readFileSync(path, "utf8"));
			} catch {
				continue;
			}
			const categories = (fields.Categories ?? "").split(";").filter(Boolean);
			// NoDisplay entries are kept on purpose: they may be hidden from the main list but still belong here.
			if (fields.Type !== "Application" || fields.Hidden === "true" || !fields.Name) continue;
			if (!categories.includes("Game")) continue;
			entries.push({
				id: file,
				path,
				name: fields.Name,
				icon: fields.Icon,
				kind: classify(fields.Name, categories),
			});
		}
	}
	return entries.sort((a, b) => a.name.localeCompare(b.name));
}
