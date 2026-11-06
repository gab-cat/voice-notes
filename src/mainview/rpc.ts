import { Electroview } from "electrobun/view";
import type { AppInfo, AppState, Note, NoteSummary, VoiceNotesRPC } from "../shared/types";

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

export const listNotes = () => req().listNotes({});
export const getNote = (id: string) => req().getNote({ id });
export const getAudio = (id: string) => req().getAudio({ id });
export const transcribe = (id: string) => req().transcribe({ id });
export const retryAuthFailed = () => req().retryAuthFailed({});
export const sendChat = (id: string, message: string) => req().sendChat({ id, message });
export const setItem = (id: string, index: number, done: boolean) => req().setItem({ id, index, done });
export const copyText = (text: string) => req().copyText({ text });
export const getState = () => req().getState({});
export const setPinned = (pinned: boolean) => req().setPinned({ pinned });
export const openSignIn = () => req().openSignIn({});
export const getAppInfo = () => req().getAppInfo({});
export const checkForUpdate = () => req().checkForUpdate({});
export const applyUpdate = () => req().applyUpdate({});
