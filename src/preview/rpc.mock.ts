// Mock of ../mainview/rpc.ts for the browser design preview.
import type { AppInfo, AppState, Note, NoteSummary, Preferences, SettingsInfo } from "../shared/types";

const now = new Date();
const iso = (minsAgo: number) => {
	const d = new Date(now.getTime() - minsAgo * 60_000);
	return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
};

const base = { fileName: "", source: "", file: "", addedAt: new Date(now.getTime() - 3 * 86_400_000).toISOString(), startedAt: new Date(now.getTime() - 14_000).toISOString(), error: "", errorKind: null, language: "", transcript: "", english: "", segments: [], summary: "", actionItems: [], questions: [], chat: [] };

const notes: Note[] = [
	{
		...base,
		id: "a",
		received: iso(4),
		status: "processing",
		duration: 38,
	},
	{
		...base,
		id: "b",
		received: iso(42),
		status: "done",
		duration: 52,
		language: "Tagalog and English",
		summary:
			"They want the pricing section moved above the testimonials, and the Arabic landing page ready by Thursday. They're waiting on a staging link.",
		transcript:
			"Hi Gab! Quick lang, pwede ba nating ilipat yung pricing section sa taas ng testimonials?\n\nAlso the client in Dubai wants the Arabic version by Thursday. Send me the staging link once it's up, salamat!",
		english:
			"Hi Gab! Quick one, can we move the pricing section above the testimonials?\n\nAlso the client in Dubai wants the Arabic version by Thursday. Send me the staging link once it's up, thanks!",
		segments: [
			{ start: 0.4, end: 2.6, text: "Hi Gab!", english: "Hi Gab!" },
			{ start: 2.6, end: 9.8, text: "Quick lang, pwede ba nating ilipat yung pricing section sa taas ng testimonials?", english: "Quick one, can we move the pricing section above the testimonials?" },
			{ start: 11.2, end: 17.5, text: "Kasi parang mas nakikita nila agad yung presyo bago pa sila mag-scroll.", english: "Because they'd see the price right away before they scroll." },
			{ start: 18.9, end: 26.4, text: "Also the client in Dubai wants the Arabic version by Thursday.", english: "" },
			{ start: 26.4, end: 34.0, text: "Hindi pa final yung copy nila, pero yung layout dapat ready na.", english: "Their copy isn't final yet, but the layout should be ready." },
			{ start: 35.5, end: 43.2, text: "Send me the staging link once it's up, para ma-check ko bago ko ipasa sa kanila.", english: "Send me the staging link once it's up, so I can check it before I pass it to them." },
			{ start: 43.2, end: 51.5, text: "Salamat, ingat!", english: "Thanks, take care!" },
		],
		actionItems: [
			{ text: "Move pricing above testimonials", done: true },
			{ text: "Ship the Arabic version by Thursday", done: false },
			{ text: "Send the staging link", done: false },
		],
		questions: ["Can we move the pricing section above the testimonials?"],
		chat: [
			{ role: "me", text: "Draft a reply", at: iso(40) },
			{
				role: "agent",
				text: "Sige! Ililipat ko na yung **pricing** sa taas ng testimonials ngayon.\n\n- Arabic version: on track for Thursday\n- Staging link: send ko agad pag live na",
				at: iso(40),
			},
		],
	},
	{ ...base, id: "c", received: iso(60 * 20), status: "error", errorKind: "auth", error: "Sign in", duration: 13 },
	{ ...base, id: "d", received: iso(60 * 30), status: "new", duration: 84 },
	{
		...base,
		id: "e",
		received: iso(60 * 50),
		status: "done",
		duration: 23,
		summary: "Asking if the invoice for October went out and whether the team can join a call on Monday at 10.",
		transcript:
			"Hey, just checking if the invoice for October already went out. I didn't see it in my inbox yet.\n\nAnd can the team join a call on Monday at 10? We want to walk through the new onboarding flow before the client sees it.\n\nLet me know, thanks.",
		error: "Antigravity failed: the request timed out.",
	},
];

const summary = (n: Note): NoteSummary => ({
	id: n.id,
	received: n.received,
	status: n.status,
	duration: n.duration,
	summary: n.summary,
	errorKind: n.errorKind,
	addedAt: n.addedAt,
});

const noteListeners = new Set<(n: Note) => void>();
const noop = () => () => {};
export const electroview = {};
const listListeners = new Set<(l: NoteSummary[]) => void>();
export const onNotes = (fn: (l: NoteSummary[]) => void) => {
	listListeners.add(fn);
	return () => listListeners.delete(fn);
};
export const onNote = (fn: (n: Note) => void) => {
	noteListeners.add(fn);
	return () => noteListeners.delete(fn);
};
export const onFocus = noop;
export const onState = noop;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let state: AppState = { pinned: true, watchName: "Downloads", downloadsBlocked: false, downloadsWaiting: false, signedIn: false };

export const listNotes = async () => notes.map(summary);
export const getNote = async (id: string) => notes.find((n) => n.id === id) ?? null;
// Silent audio of the note's length, so playback and the transcript highlight work.
function silence(seconds: number) {
	const rate = 8000;
	const n = Math.max(1, Math.round(seconds * rate));
	const buf = new Uint8Array(44 + n);
	const v = new DataView(buf.buffer);
	const txt = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
	txt(0, "RIFF");
	v.setUint32(4, 36 + n, true);
	txt(8, "WAVEfmt ");
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, rate, true);
	v.setUint32(28, rate, true);
	v.setUint16(32, 1, true);
	v.setUint16(34, 8, true);
	txt(36, "data");
	v.setUint32(40, n, true);
	buf.fill(128, 44);
	let bin = "";
	for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
	return `data:audio/wav;base64,${btoa(bin)}`;
}
export const getAudio = async (id: string) => {
	const n = notes.find((x) => x.id === id);
	return n?.duration ? silence(n.duration) : null;
};
export const takeFocus = async () => null;
const push = (n: Note) => {
	noteListeners.forEach((fn) => fn({ ...n }));
	listListeners.forEach((fn) => fn(notes.map(summary)));
};
// Plays a second transcription: queued, listening, then done again.
export const transcribe = async (id: string, _timed?: boolean) => {
	const n = notes.find((x) => x.id === id);
	if (!n) return null;
	const before = { ...n };
	Object.assign(n, { status: "queued", error: "" });
	push(n);
	setTimeout(() => {
		Object.assign(n, { status: "processing", startedAt: new Date().toISOString() });
		push(n);
	}, 600);
	setTimeout(() => {
		Object.assign(n, { ...before, status: "done", error: "", startedAt: null });
		push(n);
	}, 3200);
	return n;
};
export const dismissError = async (id: string) => {
	await wait(200);
	const n = notes.find((x) => x.id === id)!;
	n.error = "";
	push(n);
	return n;
};
export const retryAuthFailed = async () => wait(800);
export const sendChat = async (id: string, message: string) => {
	await wait(1200);
	const n = notes.find((x) => x.id === id)!;
	n.chat = [...n.chat, { role: "me", text: message, at: iso(0) }, { role: "agent", text: "Here's a short reply you can send.", at: iso(0) }];
	noteListeners.forEach((fn) => fn({ ...n }));
	return n;
};
export const setItem = async (id: string, index: number, done: boolean) => {
	const n = notes.find((x) => x.id === id)!;
	n.actionItems[index].done = done;
	noteListeners.forEach((fn) => fn({ ...n, actionItems: [...n.actionItems] }));
	return n;
};
export const copyText = async (text: string) => navigator.clipboard?.writeText(text).catch(() => {});
export const getState = async () => state;
export const setPinned = async (pinned: boolean) => (state = { ...state, pinned });
export const openSignIn = async () => {};

const info: AppInfo = {
	version: "0.1.0",
	channel: "stable",
	updatePhase: "ready",
	updateProgress: 100,
	availableVersion: "0.1.1",
	updateReady: true,
	error: null,
};
export const onAppInfo = noop;
export const getAppInfo = async () => info;
export const checkForUpdate = async () => {
	await wait(900);
	return info;
};
export const applyUpdate = async () => wait(1500);

export const deleteNote = async (id: string) => {
	await wait(300);
	const i = notes.findIndex((n) => n.id === id);
	if (i >= 0) notes.splice(i, 1);
	listListeners.forEach((fn) => fn(notes.map(summary)));
};

const defaults: Preferences = {
	watchDir: "/Users/me/Downloads",
	pattern: "^WhatsApp.*\\.(opus|ogg|m4a|mp3|aac)$",
	model: "gemini-3.8-flash",
	effort: "low",
	retentionDays: 7,
	timed: false,
};
let prefs: Preferences = { ...defaults };
const settingsInfo = (): SettingsInfo => ({
	prefs,
	defaults,
	audioDir: "/Users/me/Library/Application Support/Voice Notes/Voice notes",
	models: [
		{ id: "gemini-4-argon", label: "Gemini 4 Argon", efforts: ["low", "medium", "high"] },
		{ id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", efforts: ["low", "medium", "high"] },
		{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", efforts: ["low", "medium", "high"] },
		{ id: "gpt-oss-120b", label: "GPT-OSS 120B", efforts: ["medium"] },
	],
});
export const getSettings = async () => settingsInfo();
export const setPreferences = async (p: Partial<Preferences>) => {
	await wait(250);
	prefs = { ...prefs, ...p };
	return settingsInfo();
};
const files = [
	"WhatsApp Ptt 2026-11-07 at 10.12.33.opus",
	"WhatsApp Audio 2026-11-06 at 18.40.02.opus",
	"WhatsApp Ptt 2026-11-05 at 09.03.11.ogg",
	"Recording 12.m4a",
];
export const testPattern = async (pattern: string) => {
	await wait(120);
	try {
		const re = new RegExp(pattern, "i");
		const m = files.filter((f) => re.test(f));
		return { error: "", matches: m.slice(0, 3), total: m.length };
	} catch (err) {
		return { error: (err as Error).message.replace(/^Invalid regular expression: (\/.*\/[a-z]*: )?/, ""), matches: [], total: 0 };
	}
};
export const chooseFolder = async () => "/Users/me/Desktop/Client audio";
export const showAudioFolder = async () => {};

// In the preview console: __finish("a") plays the end of a transcription.
(window as unknown as { __finish: (id: string) => void }).__finish = (id) => {
	const i = notes.findIndex((x) => x.id === id);
	const done = notes.find((x) => x.id === "b")!;
	if (i < 0) return;
	const n: Note = { ...done, id, received: notes[i].received, status: "done", chat: [], startedAt: null };
	notes[i] = n;
	noteListeners.forEach((fn) => fn({ ...n }));
	listListeners.forEach((fn) => fn(notes.map(summary)));
};
