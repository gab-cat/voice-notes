import type { RPCSchema } from "electrobun/bun";

// new: was already in Downloads when the app first ran, never sent to the agent
export type NoteStatus = "new" | "queued" | "processing" | "done" | "error";
export type ErrorKind = "auth" | "missing-cli" | "other";

export type ActionItem = { text: string; done: boolean };
export type ChatMessage = { role: "me" | "agent"; text: string; at: string };
/** One timed line of a transcript, like an SRT cue. Seconds from the start. */
export type Segment = { start: number; end: number; text: string; english: string };

export type Note = {
	id: string;
	fileName: string;
	source: string; // where the file was found, e.g. in Downloads
	file: string; // the audio in the app's voice notes folder, "" if missing
	addedAt: string; // ISO UTC, when the app took the file; retention counts from here
	startedAt: string | null; // ISO UTC, when the current transcription started
	received: string; // ISO, local time
	status: NoteStatus;
	error: string;
	errorKind: ErrorKind | null;
	duration: number | null; // seconds
	language: string;
	transcript: string;
	english: string;
	segments: Segment[]; // empty unless transcribed with timings
	summary: string;
	actionItems: ActionItem[];
	questions: string[];
	chat: ChatMessage[];
};

export type NoteSummary = Pick<
	Note,
	"id" | "received" | "status" | "duration" | "summary" | "errorKind" | "addedAt"
>;

export type Effort = "low" | "medium" | "high";

export type Preferences = {
	watchDir: string; // folder to watch for new voice notes
	pattern: string; // regex on file names, case-insensitive
	model: string; // agy model family, e.g. "gemini-3.8-flash"
	effort: Effort;
	retentionDays: number; // 0 keeps voice notes forever
	timed: boolean; // transcribe with timings, like subtitles
};

export type ModelOption = { id: string; label: string; efforts: Effort[] };

export type SettingsInfo = {
	prefs: Preferences;
	defaults: Preferences;
	audioDir: string;
	models: ModelOption[];
};

export type PatternTest = { error: string; matches: string[]; total: number };

export type AppState = {
	pinned: boolean;
	watchName: string; // display name of the watched folder
	downloadsBlocked: boolean;
	downloadsWaiting: boolean; // macOS is showing its Downloads access prompt
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
			transcribe: { params: { id: string; timed?: boolean }; response: Note | null };
			retryAuthFailed: { params: {}; response: void };
			dismissError: { params: { id: string }; response: Note | null };
			sendChat: { params: { id: string; message: string }; response: Note };
			setItem: { params: { id: string; index: number; done: boolean }; response: Note | null };
			copyText: { params: { text: string }; response: void };
			getState: { params: {}; response: AppState };
			setPinned: { params: { pinned: boolean }; response: AppState };
			openSignIn: { params: {}; response: void };
			takeFocus: { params: {}; response: string | null };
			getAppInfo: { params: {}; response: AppInfo };
			checkForUpdate: { params: {}; response: AppInfo };
			applyUpdate: { params: {}; response: void };
			deleteNote: { params: { id: string }; response: void };
			getSettings: { params: {}; response: SettingsInfo };
			setPreferences: { params: Partial<Preferences>; response: SettingsInfo };
			testPattern: { params: { pattern: string; watchDir: string }; response: PatternTest };
			chooseFolder: { params: { start: string }; response: string | null };
			showAudioFolder: { params: {}; response: void };
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
