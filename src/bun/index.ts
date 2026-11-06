import Electrobun, { BrowserView, BrowserWindow, Screen, Tray, Updater, Utils } from "electrobun/bun";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppInfo, AppState, Note, NoteSummary, VoiceNotesRPC } from "../shared/types";
import { AGY } from "./agent";
import * as notes from "./notes";
import * as updates from "./updates";

const DEV_SERVER_URL = "http://localhost:5173";
const WIDTH = 380;
const HEIGHT = 600;
const SETTINGS_FILE = join(notes.SUPPORT_DIR, "settings.json");

type Settings = { pinned: boolean; x: number | null; y: number | null };
let settings: Settings = { pinned: true, x: null, y: null };
try {
	settings = { ...settings, ...JSON.parse(await readFile(SETTINGS_FILE, "utf8")) };
} catch {}
const saveSettings = () => writeFile(SETTINGS_FILE, JSON.stringify(settings)).catch(() => {});

const state: AppState = { pinned: settings.pinned, downloadsBlocked: false, signedIn: null };

let win: BrowserWindow | null = null;

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
			listNotes: () => notes.listNotes(),
			getNote: ({ id }) => notes.getNote(id),
			getAudio: ({ id }) => notes.getAudio(id),
			transcribe: ({ id }) => notes.transcribe(id),
			retryAuthFailed: () => notes.retryAuthFailed(),
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
				const script = join(notes.SUPPORT_DIR, "Sign in to Antigravity.command");
				await writeFile(
					script,
					`#!/bin/zsh\nclear\necho "Sign in with Google, paste the code here, then type /quit and go back to Voice Notes."\necho\n"${AGY}"\n`,
					{ mode: 0o755 },
				);
				Utils.openPath(script);
			},
			getAppInfo: () => ({ ...updates.appInfo }),
			checkForUpdate: async () => {
				await updates.checkForUpdate();
				return { ...updates.appInfo };
			},
			applyUpdate: () => updates.applyUpdate(),
		},
		messages: {},
	},
});

async function viewUrl() {
	if ((await Updater.localInfo.channel()) === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			return DEV_SERVER_URL;
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

mkdirSync(notes.SUPPORT_DIR, { recursive: true });
await notes.start({
	onListChanged: (list) => {
		send()?.notesChanged(list);
		updateTray();
	},
	onNoteChanged: (note) => send()?.noteChanged(note),
	onFinished: (note) => {
		Utils.showNotification(
			note.status === "done"
				? { title: "Voice note transcribed", body: note.summary.slice(0, 180) }
				: { title: "Voice note failed", body: note.error.slice(0, 180) },
		);
	},
	onNewNote: (id) => {
		openWindow();
		// Give a freshly created window a moment to load before focusing.
		setTimeout(() => send()?.focusNote({ id }), 600);
		send()?.focusNote({ id });
	},
	onAuth: (signedIn) => {
		if (state.signedIn === signedIn) return;
		state.signedIn = signedIn;
		pushState();
	},
	onDownloadsBlocked: (blocked) => {
		if (state.downloadsBlocked === blocked) return;
		state.downloadsBlocked = blocked;
		pushState();
	},
});

Electrobun.events.on("reopen", () => openWindow());
console.log("Voice Notes started");
