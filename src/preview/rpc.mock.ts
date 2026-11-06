// Mock of ../mainview/rpc.ts for the browser design preview.
import type { AppInfo, AppState, Note, NoteSummary } from "../shared/types";

const now = new Date();
const iso = (minsAgo: number) => {
	const d = new Date(now.getTime() - minsAgo * 60_000);
	return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
};

const base = { fileName: "", source: "", error: "", errorKind: null, language: "", transcript: "", english: "", summary: "", actionItems: [], questions: [], chat: [] };

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
		transcript: "…",
	},
];

const summary = (n: Note): NoteSummary => ({
	id: n.id,
	received: n.received,
	status: n.status,
	duration: n.duration,
	summary: n.summary,
	errorKind: n.errorKind,
});

const noteListeners = new Set<(n: Note) => void>();
const noop = () => () => {};
export const electroview = {};
export const onNotes = noop;
export const onNote = (fn: (n: Note) => void) => {
	noteListeners.add(fn);
	return () => noteListeners.delete(fn);
};
export const onFocus = noop;
export const onState = noop;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let state: AppState = { pinned: true, downloadsBlocked: false, signedIn: false };

export const listNotes = async () => notes.map(summary);
export const getNote = async (id: string) => notes.find((n) => n.id === id) ?? null;
export const getAudio = async () => null;
export const transcribe = async (id: string) => notes.find((n) => n.id === id) ?? null;
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
