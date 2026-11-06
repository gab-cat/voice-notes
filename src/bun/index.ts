import Electrobun, { BrowserView, BrowserWindow, Screen, Tray, Updater, Utils } from "electrobun/bun";
import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AppInfo, AppState, Note, NoteSummary, SettingsInfo, VoiceNotesRPC } from "../shared/types";
import { AGY } from "./agent";
import * as notes from "./notes";
import * as prefs from "./settings";
import { save as saveSettings, settings } from "./settings";
import * as updates from "./updates";
import { debug } from "./debug";

debug("app starting");

const DEV_SERVER_URL = "http://localhost:5173";
const WIDTH = 380;
const HEIGHT = 600;

const folderName = (dir: string) => basename(dir) || dir;

const state: AppState = {
	pinned: settings.pinned,
	watchName: folderName(settings.watchDir),
	downloadsBlocked: false,
	downloadsWaiting: false,
	signedIn: null,
};

let win: BrowserWindow | null = null;
// Note to open once a freshly created window asks for it (takeFocus);
// a push to a window that's still loading can be lost.
let pendingFocus: string | null = null;

type Push = {
	notesChanged(l: NoteSummary[]): void;
	noteChanged(n: Note): void;
	focusNote(p: { id: string }): void;
	stateChanged(s: AppState): void;
	appInfoChanged(i: AppInfo): void;
};
const send = () => (win?.webview.rpc as unknown as { send: Push } | undefined)?.send;

function pushState() {
	send()?.stateChanged({ ...state });
}

const rpc = BrowserView.defineRPC<VoiceNotesRPC>({
	maxRequestTime: 10 * 60_000,
	handlers: {
		requests: {
			listNotes: () => {
				const list = notes.listNotes();
				debug("rpc listNotes ->", list.length);
				return list;
			},
			getNote: ({ id }) => notes.getNote(id),
			getAudio: ({ id }) => notes.getAudio(id),
			transcribe: ({ id, timed }) => notes.transcribe(id, timed),
			retryAuthFailed: () => notes.retryAuthFailed(),
			dismissError: ({ id }) => notes.dismissError(id),
			sendChat: ({ id, message }) => notes.sendChat(id, message),
			setItem: ({ id, index, done }) => notes.setItem(id, index, done),
			copyText: ({ text }) => Utils.clipboardWriteText(text),
			getState: () => ({ ...state }),
			setPinned: ({ pinned }) => {
				state.pinned = settings.pinned = pinned;
				win?.setAlwaysOnTop(pinned);
				void saveSettings();
				pushState();
				return { ...state };
			},
			openSignIn: async () => {
				// A .command file opens in Terminal without needing Apple Events access.
				const script = join(prefs.SUPPORT_DIR, "Sign in to Antigravity.command");
				await writeFile(
					script,
					`#!/bin/zsh\nclear\necho "Sign in with Google, paste the code here, then type /quit and go back to Voice Notes."\necho\n"${AGY}"\n`,
					{ mode: 0o755 },
				);
				Utils.openPath(script);
			},
			takeFocus: () => {
				const id = pendingFocus;
				pendingFocus = null;
				return id;
			},
			getAppInfo: () => ({ ...updates.appInfo }),
			checkForUpdate: async () => {
				await updates.checkForUpdate();
				return { ...updates.appInfo };
			},
			applyUpdate: () => updates.applyUpdate(),
			deleteNote: ({ id }) => notes.deleteNote(id),
			getSettings: () => settingsInfo(),
			setPreferences: (p) => {
				prefs.update(p);
				return settingsInfo();
			},
			testPattern: ({ pattern, watchDir }) => notes.testPattern(pattern, watchDir),
			chooseFolder: async ({ start }) => {
				const picked = await Utils.openFileDialog({
					startingFolder: start,
					canChooseFiles: false,
					canChooseDirectory: true,
					allowsMultipleSelection: false,
				}).catch(() => [] as string[]);
				return picked.find((p) => p.trim()) ?? null;
			},
			showAudioFolder: () => {
				Utils.openPath(prefs.AUDIO_DIR);
			},
		},
		messages: {},
	},
});

function settingsInfo(): SettingsInfo {
	return { prefs: prefs.prefs(), defaults: prefs.DEFAULTS, audioDir: prefs.AUDIO_DIR, models: prefs.listModels() };
}

prefs.onChange(() => {
	const name = folderName(settings.watchDir);
	if (name === state.watchName) return;
	state.watchName = name;
	pushState();
});
void prefs.loadModels();

async function viewUrl() {
	if ((await Updater.localInfo.channel()) === "dev") {
		// Only when it's this app's dev server: another project often has 5173.
		try {
			const html = await fetch(DEV_SERVER_URL, { signal: AbortSignal.timeout(1500) }).then((r) => r.text());
			if (/<title>Voice Notes<\/title>/.test(html)) return DEV_SERVER_URL;
		} catch {}
	}
	return "views://mainview/index.html";
}

function startPosition() {
	if (settings.x != null && settings.y != null) return { x: settings.x, y: settings.y };
	try {
		const { workArea } = Screen.getPrimaryDisplay();
		return { x: workArea.x + workArea.width - WIDTH - 24, y: workArea.y + 24 };
	} catch {
		return { x: 200, y: 120 };
	}
}

const url = await viewUrl();

function openWindow() {
	if (win) {
		win.show();
		win.activate();
		return win;
	}
	const pos = startPosition();
	win = new BrowserWindow({
		title: "Voice Notes",
		url,
		rpc,
		titleBarStyle: "hiddenInset",
		trafficLightOffset: { x: 8, y: 12 },
		frame: { width: WIDTH, height: HEIGHT, x: pos.x, y: pos.y },
		styleMask: {
			Titled: true,
			Closable: true,
			Resizable: true,
			Miniaturizable: true,
			Borderless: false,
			FullSizeContentView: false,
			FullScreen: false,
			UnifiedTitleAndToolbar: false,
			UtilityWindow: false,
		},
	});
	win.setAlwaysOnTop(settings.pinned);
	win.on("close", () => {
		win = null;
	});
	return win;
}

// Remember where the window was left.
setInterval(() => {
	if (!win) return;
	try {
		const { x, y } = win.getFrame();
		if (x !== settings.x || y !== settings.y) {
			settings.x = x;
			settings.y = y;
			void saveSettings();
		}
	} catch {}
}, 2000);

openWindow();

// ── menu bar ───────────────────────────────────────────────────────────────

const channel = await Updater.localInfo.channel();
const trayIcon =
	channel === "dev"
		? join(import.meta.dir, "..", "mainview", "public", "tray-icon.png")
		: "views://mainview/tray-icon.png";
const tray = new Tray({ title: "", image: trayIcon, template: true, width: 18, height: 18 });

function updateTray() {
	const pending = notes.listNotes().filter((n) => n.status === "queued" || n.status === "processing").length;
	tray.setMenu([
		...(pending
			? [{ type: "normal" as const, label: `Transcribing ${pending} voice note${pending > 1 ? "s" : ""}`, enabled: false }, { type: "divider" as const }]
			: []),
		{ type: "normal" as const, label: "Show Voice Notes", action: "show" },
		{ type: "normal" as const, label: "Keep on top", action: "pin", checked: settings.pinned },
		{ type: "divider" as const },
		updates.appInfo.updateReady
			? {
					type: "normal" as const,
					label: `Restart to update${updates.appInfo.availableVersion ? ` to ${updates.appInfo.availableVersion}` : ""}`,
					action: "apply-update",
				}
			: {
					type: "normal" as const,
					label:
						updates.appInfo.updatePhase === "checking"
							? "Checking for updates…"
							: updates.appInfo.updatePhase === "downloading"
								? "Downloading update…"
								: "Check for updates",
					action: "check-update",
					enabled: updates.appInfo.channel !== "dev" && updates.appInfo.updatePhase !== "checking" && updates.appInfo.updatePhase !== "downloading",
				},
		{ type: "divider" as const },
		{ type: "normal" as const, label: "Quit", action: "quit" },
	]);
}
tray.on("tray-clicked", (event) => {
	const action = (event as { action?: string } | undefined)?.action;
	if (action === "show") openWindow();
	else if (action === "pin") {
		state.pinned = settings.pinned = !settings.pinned;
		win?.setAlwaysOnTop(settings.pinned);
		void saveSettings();
		pushState();
		updateTray();
	} else if (action === "check-update") void updates.checkForUpdate();
	else if (action === "apply-update") void updates.applyUpdate();
	else if (action === "quit") Utils.quit();
});
updateTray();

await updates.startUpdates((info) => {
	send()?.appInfoChanged(info);
	updateTray();
});

// ── notes ──────────────────────────────────────────────────────────────────

debug("starting notes");
await notes.start({
	onListChanged: (list) => {
		send()?.notesChanged(list);
		updateTray();
	},
	onNoteChanged: (note) => send()?.noteChanged(note),
	onFinished: (note) => {
		Utils.showNotification(
			note.status === "done" && !note.error
				? { title: "Voice note transcribed", body: note.summary.slice(0, 180) }
				: note.status === "done"
					? { title: "Couldn't transcribe again", body: `The earlier transcript is kept. ${note.error}`.slice(0, 180) }
					: { title: "Voice note failed", body: note.error.slice(0, 180) },
		);
	},
	onNewNote: (id) => {
		const wasOpen = win !== null;
		openWindow();
		if (wasOpen) send()?.focusNote({ id });
		else pendingFocus = id; // the new window picks it up via takeFocus
	},
	onAuth: (signedIn) => {
		if (state.signedIn === signedIn) return;
		state.signedIn = signedIn;
		pushState();
	},
	onDownloadsWaiting: (waiting) => {
		if (state.downloadsWaiting === waiting) return;
		state.downloadsWaiting = waiting;
		pushState();
	},
	onDownloadsBlocked: (blocked) => {
		if (state.downloadsBlocked === blocked) return;
		state.downloadsBlocked = blocked;
		pushState();
	},
});

debug("notes started", notes.listNotes().length);
Electrobun.events.on("reopen", () => openWindow());
console.log("Voice Notes started");
