// One settings file for the window and for how voice notes are picked up,
// transcribed and kept.

import { mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Effort, ModelOption, Preferences } from "../shared/types";
import { AGY } from "./agent";
import { debug } from "./debug";

export const SUPPORT_DIR = join(homedir(), "Library", "Application Support", "Voice Notes");
/** The folder the app owns: matching files are moved here and read from here. */
export const AUDIO_DIR = join(SUPPORT_DIR, "Voice notes");
const FILE = join(SUPPORT_DIR, "settings.json");

mkdirSync(AUDIO_DIR, { recursive: true });

/** Only audio is ever moved, whatever the pattern says. */
export const AUDIO_EXT = /\.(opus|ogg|m4a|mp3|aac|wav)$/i;

export const DEFAULTS: Preferences = {
	watchDir: join(homedir(), "Downloads"),
	pattern: "^WhatsApp.*\\.(opus|ogg|m4a|mp3|aac)$",
	model: "gemini-3.8-flash",
	// Low is about 3x faster than medium for transcription with the same result.
	effort: "low",
	retentionDays: 7,
	timed: false,
};

type Window = { pinned: boolean; x: number | null; y: number | null };
type Stored = Window & Preferences;

let stored: Stored = { pinned: true, x: null, y: null, ...DEFAULTS };
try {
	stored = { ...stored, ...JSON.parse(readFileSync(FILE, "utf8")) };
} catch {}
if (!compile(stored.pattern)) stored.pattern = DEFAULTS.pattern;

export const settings = stored;

let writing = Promise.resolve();
export function save() {
	writing = writing.then(async () => {
		const tmp = `${FILE}.tmp`;
		await writeFile(tmp, JSON.stringify(stored, null, 2));
		await rename(tmp, FILE);
	}).catch(() => {});
	return writing;
}

export function prefs(): Preferences {
	const { watchDir, pattern, model, effort, retentionDays, timed } = stored;
	return { watchDir, pattern, model, effort, retentionDays, timed };
}

export function compile(pattern: string): RegExp | null {
	try {
		return pattern.trim() ? new RegExp(pattern, "i") : null;
	} catch {
		return null;
	}
}

export function patternError(pattern: string) {
	if (!pattern.trim()) return "Enter a pattern.";
	try {
		new RegExp(pattern, "i");
		return "";
	} catch (err) {
		return (err as Error).message.replace(/^Invalid regular expression: (\/.*\/[a-z]*: )?/, "");
	}
}

const listeners = new Set<(p: Preferences, prev: Preferences) => void>();
export const onChange = (fn: (p: Preferences, prev: Preferences) => void) => listeners.add(fn);

export function update(p: Partial<Preferences>): Preferences {
	const prev = prefs();
	const next = { ...prev };
	if (typeof p.watchDir === "string" && p.watchDir.trim()) next.watchDir = p.watchDir.trim();
	if (typeof p.pattern === "string") {
		const err = patternError(p.pattern);
		if (err) throw new Error(err);
		next.pattern = p.pattern;
	}
	if (typeof p.model === "string" && p.model) next.model = p.model;
	if (p.effort === "low" || p.effort === "medium" || p.effort === "high") next.effort = p.effort;
	if (typeof p.retentionDays === "number" && Number.isFinite(p.retentionDays))
		next.retentionDays = Math.max(0, Math.min(365, Math.round(p.retentionDays)));
	if (typeof p.timed === "boolean") next.timed = p.timed;
	Object.assign(stored, next);
	void save();
	listeners.forEach((fn) => fn(next, prev));
	return next;
}

// ── models ─────────────────────────────────────────────────────────────────

const EFFORTS: Effort[] = ["low", "medium", "high"];

// Used until `agy models` answers, or when it can't.
let models: ModelOption[] = [
	{ id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", efforts: EFFORTS },
	{ id: "gemini-4-argon", label: "Gemini 4 Argon", efforts: EFFORTS },
];

export const listModels = () => models;

/** The id agy expects, e.g. "gemini-3.8-flash-medium". */
export function modelId() {
	const family = models.find((m) => m.id === stored.model);
	const effort = family && !family.efforts.includes(stored.effort) ? family.efforts[family.efforts.length - 1] : stored.effort;
	return `${stored.model}-${effort}`;
}

export async function loadModels() {
	try {
		const p = Bun.spawn([AGY, "models"], { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
		const timer = setTimeout(() => p.kill(), 20_000);
		const out = await new Response(p.stdout).text();
		await p.exited;
		clearTimeout(timer);
		const byFamily = new Map<string, ModelOption>();
		for (const line of out.split("\n")) {
			const [id, label = ""] = line.trim().split("\t");
			const m = id?.match(/^(.+)-(low|medium|high)$/);
			if (!m) continue;
			const family = byFamily.get(m[1]) ?? {
				id: m[1],
				label: label.replace(/\s*\((low|medium|high)\)\s*$/i, "") || m[1],
				efforts: [],
			};
			family.efforts.push(m[2] as Effort);
			byFamily.set(m[1], family);
		}
		if (byFamily.size) {
			models = [...byFamily.values()].map((f) => ({
				...f,
				efforts: EFFORTS.filter((e) => f.efforts.includes(e)),
			}));
		}
		debug("models", models.map((m) => m.id));
	} catch (err) {
		debug("models failed", (err as Error).message);
	}
	return models;
}
