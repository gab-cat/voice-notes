// Opt-in debug log for release builds (which print nothing to a console).
// Turn on: touch "~/Library/Application Support/Voice Notes/debug"
// Log:     ~/Library/Logs/Voice Notes.log
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const enabled = existsSync(join(homedir(), "Library", "Application Support", "Voice Notes", "debug"));
const file = join(homedir(), "Library", "Logs", "Voice Notes.log");
if (enabled) mkdirSync(join(homedir(), "Library", "Logs"), { recursive: true });

export function debug(...parts: unknown[]) {
	if (!enabled) return;
	const line = `${new Date().toISOString()} ${parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ")}\n`;
	try {
		appendFileSync(file, line);
	} catch {}
}
