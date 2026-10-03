import {
	Action,
	ActionPanel,
	closeMainWindow,
	Icon,
	List,
	LocalStorage,
	showToast,
	Toast,
} from "@vicinae/api";
import { spawn } from "node:child_process";
import { useEffect, useMemo, useState } from "react";
import { type Entry, loadEntries, SECTIONS } from "./lib/entries";

const HIDDEN_KEY = "hidden";

async function launch(entry: Entry) {
	try {
		spawn("gio", ["launch", entry.path], { detached: true, stdio: "ignore" }).unref();
		await closeMainWindow();
	} catch (e) {
		await showToast({ style: Toast.Style.Failure, title: `Failed to launch ${entry.name}`, message: String(e) });
	}
}

export default function Games() {
	const entries = useMemo(loadEntries, []);
	const [hidden, setHidden] = useState<Set<string>>(new Set());
	const [showHidden, setShowHidden] = useState(false);

	useEffect(() => {
		LocalStorage.getItem<string>(HIDDEN_KEY).then((raw) => {
			if (raw) setHidden(new Set(JSON.parse(raw)));
		});
	}, []);

	const setHiddenState = (id: string, hide: boolean) => {
		const next = new Set(hidden);
		if (hide) next.add(id);
		else next.delete(id);
		setHidden(next);
		LocalStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
	};

	const renderItem = (entry: Entry, isHidden: boolean) => (
		<List.Item
			key={entry.id}
			title={entry.name}
			icon={entry.icon ? { source: entry.icon, fallback: Icon.GameController } : Icon.GameController}
			actions={
				<ActionPanel>
					<Action title="Launch" icon={Icon.Play} onAction={() => launch(entry)} />
					{isHidden ? (
						<Action title="Unhide" icon={Icon.Eye} onAction={() => setHiddenState(entry.id, false)} />
					) : (
						<Action
							title="Hide from Games"
							icon={Icon.EyeDisabled}
							shortcut={{ modifiers: ["ctrl"], key: "h" }}
							onAction={() => setHiddenState(entry.id, true)}
						/>
					)}
					<Action
						title={showHidden ? "Don't Show Hidden Items" : "Show Hidden Items"}
						icon={Icon.Eye}
						shortcut={{ modifiers: ["ctrl", "shift"], key: "h" }}
						onAction={() => setShowHidden(!showHidden)}
					/>
					<Action.CopyToClipboard title="Copy Desktop File Path" content={entry.path} />
				</ActionPanel>
			}
		/>
	);

	const visible = entries.filter((e) => !hidden.has(e.id));
	const hiddenEntries = entries.filter((e) => hidden.has(e.id));

	return (
		<List searchBarPlaceholder="Search games…" navigationTitle="Games">
			{SECTIONS.map(({ kind, title }) => {
				const items = visible.filter((e) => e.kind === kind);
				if (items.length === 0) return null;
				return (
					<List.Section key={kind} title={`${title} (${items.length})`}>
						{items.map((e) => renderItem(e, false))}
					</List.Section>
				);
			})}
			{showHidden && hiddenEntries.length > 0 && (
				<List.Section title={`Hidden (${hiddenEntries.length})`}>
					{hiddenEntries.map((e) => renderItem(e, true))}
				</List.Section>
			)}
		</List>
	);
}
