import { Electroview } from "electrobun/view";
import type { AppInfo, AppState, Note, NoteSummary, Preferences, VoiceNotesRPC } from "../shared/types";

type Listeners = {
	notes: Set<(l: NoteSummary[]) => void>;
	note: Set<(n: Note) => void>;
	focus: Set<(id: string) => void>;
	state: Set<(s: AppState) => void>;
	appInfo: Set<(i: AppInfo) => void>;
};
const listeners: Listeners = {
	notes: new Set(),
	note: new Set(),
	focus: new Set(),
	state: new Set(),
	appInfo: new Set(),
};

function on<K extends keyof Listeners>(key: K, fn: Listeners[K] extends Set<infer F> ? F : never) {
	(listeners[key] as Set<typeof fn>).add(fn);
	return () => {
		(listeners[key] as Set<typeof fn>).delete(fn);
	};
}

export const onNotes = (fn: (l: NoteSummary[]) => void) => on("notes", fn);
export const onNote = (fn: (n: Note) => void) => on("note", fn);
export const onFocus = (fn: (id: string) => void) => on("focus", fn);
export const onState = (fn: (s: AppState) => void) => on("state", fn);
export const onAppInfo = (fn: (i: AppInfo) => void) => on("appInfo", fn);

const rpc = Electroview.defineRPC<VoiceNotesRPC>({
	// Transcription and chat wait on the agent, which can take a while.
	maxRequestTime: 10 * 60_000,
	handlers: {
		requests: {},
		messages: {
			notesChanged: (l) => listeners.notes.forEach((fn) => fn(l)),
			noteChanged: (n) => listeners.note.forEach((fn) => fn(n)),
			focusNote: ({ id }) => listeners.focus.forEach((fn) => fn(id)),
			stateChanged: (s) => listeners.state.forEach((fn) => fn(s)),
			appInfoChanged: (i) => listeners.appInfo.forEach((fn) => fn(i)),
		},
	},
});

export const electroview = new Electroview({ rpc });
const req = () => electroview.rpc!.request;

// A request sent while the view is still connecting to the app can be
// dropped without an error (it would then wait for maxRequestTime). Quick
// reads therefore time out and retry until the app answers.
async function read<T>(fn: () => Promise<T>, attempts = 30): Promise<T> {
	let wait = 250;
	for (let i = 0; ; i++) {
		try {
			return await Promise.race([
				fn(),
				new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500)),
			]);
		} catch (err) {
			if (i >= attempts - 1) throw err;
			await new Promise((r) => setTimeout(r, wait));
			wait = Math.min(wait * 2, 2000);
		}
	}
}

export const listNotes = () => read(() => req().listNotes({}));
export const getNote = (id: string) => read(() => req().getNote({ id }));
export const takeFocus = () => read(() => req().takeFocus({}));
export const getAudio = (id: string) => req().getAudio({ id });
export const transcribe = (id: string, timed?: boolean) => req().transcribe({ id, timed });
export const retryAuthFailed = () => req().retryAuthFailed({});
export const dismissError = (id: string) => req().dismissError({ id });
export const sendChat = (id: string, message: string) => req().sendChat({ id, message });
export const setItem = (id: string, index: number, done: boolean) => req().setItem({ id, index, done });
export const copyText = (text: string) => req().copyText({ text });
export const getState = () => read(() => req().getState({}));
export const setPinned = (pinned: boolean) => req().setPinned({ pinned });
export const openSignIn = () => req().openSignIn({});
export const getAppInfo = () => read(() => req().getAppInfo({}));
export const checkForUpdate = () => req().checkForUpdate({});
export const applyUpdate = () => req().applyUpdate({});
export const deleteNote = (id: string) => req().deleteNote({ id });
export const getSettings = () => read(() => req().getSettings({}));
export const setPreferences = (p: Partial<Preferences>) => req().setPreferences(p);
export const testPattern = (pattern: string, watchDir: string) => req().testPattern({ pattern, watchDir });
export const chooseFolder = (start: string) => req().chooseFolder({ start });
export const showAudioFolder = () => req().showAudioFolder({});
