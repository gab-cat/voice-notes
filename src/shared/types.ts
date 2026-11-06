import type { RPCSchema } from "electrobun/bun";

// new: was already in Downloads when the app first ran, never sent to the agent
export type NoteStatus = "new" | "queued" | "processing" | "done" | "error";
export type ErrorKind = "auth" | "missing-cli" | "other";

export type ActionItem = { text: string; done: boolean };
export type ChatMessage = { role: "me" | "agent"; text: string; at: string };

export type Note = {
	id: string;
	fileName: string;
	source: string;
	received: string; // ISO, local time
	status: NoteStatus;
	error: string;
	errorKind: ErrorKind | null;
	duration: number | null; // seconds
	language: string;
	transcript: string;
	english: string;
	summary: string;
	actionItems: ActionItem[];
	questions: string[];
	chat: ChatMessage[];
};

export type NoteSummary = Pick<
	Note,
	"id" | "received" | "status" | "duration" | "summary" | "errorKind"
>;

export type AppState = {
	pinned: boolean;
	downloadsBlocked: boolean;
	signedIn: boolean | null; // null until the first agent call
};

export type UpdatePhase = "idle" | "checking" | "downloading" | "ready" | "error";

export type AppInfo = {
	version: string;
	channel: string;
	updatePhase: UpdatePhase;
	updateProgress: number | null;
	availableVersion: string | null;
	updateReady: boolean;
	error: string | null;
};

export type VoiceNotesRPC = {
	bun: RPCSchema<{
		requests: {
			listNotes: { params: {}; response: NoteSummary[] };
			getNote: { params: { id: string }; response: Note | null };
			getAudio: { params: { id: string }; response: string | null }; // data URL
			transcribe: { params: { id: string }; response: Note | null };
			retryAuthFailed: { params: {}; response: void };
			sendChat: { params: { id: string; message: string }; response: Note };
			setItem: { params: { id: string; index: number; done: boolean }; response: Note | null };
			copyText: { params: { text: string }; response: void };
			getState: { params: {}; response: AppState };
			setPinned: { params: { pinned: boolean }; response: AppState };
			openSignIn: { params: {}; response: void };
			getAppInfo: { params: {}; response: AppInfo };
			checkForUpdate: { params: {}; response: AppInfo };
			applyUpdate: { params: {}; response: void };
		};
		messages: {};
	}>;
	webview: RPCSchema<{
		requests: {};
		messages: {
			notesChanged: NoteSummary[];
			noteChanged: Note;
			focusNote: { id: string };
			stateChanged: AppState;
			appInfoChanged: AppInfo;
		};
	}>;
};
