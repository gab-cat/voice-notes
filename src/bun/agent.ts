// Runs the Antigravity CLI (`agy`) in headless print mode.
//
// Safety: voice notes come from other people, so their content is untrusted.
// We never pass --dangerously-skip-permissions or an auto mode. In headless
// runs any tool that needs approval (shell, edits) is soft-denied, and
// --sandbox adds terminal restrictions on top.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ErrorKind } from "../shared/types";

export const AGY = [join(homedir(), ".local/bin/agy"), "/opt/homebrew/bin/agy", "/usr/local/bin/agy"].find(
	existsSync,
) ?? join(homedir(), ".local/bin/agy");

const PATH = [join(homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");

export class AgentError extends Error {
	constructor(
		message: string,
		public kind: ErrorKind,
	) {
		super(message);
	}
}

export const SIGN_IN_MESSAGE = "Sign in to Antigravity to transcribe voice notes.";

type Envelope = {
	status?: string;
	response?: string;
	error?: string;
	structured_output?: unknown;
};

export async function runAgent(
	prompt: string,
	// The model is always passed so results don't shift when agy's default changes.
	opts: { cwd: string; model: string; schema?: object; timeoutSec?: number },
): Promise<{ text: string; structured: unknown }> {
	if (!existsSync(AGY)) {
		throw new AgentError("Antigravity CLI isn't installed. Install it from antigravity.google.", "missing-cli");
	}
	const args = [
		AGY,
		"-p",
		prompt,
		"--model",
		opts.model,
		"--output-format",
		"json",
		"--disable-slash-commands",
		"--sandbox",
		"--print-timeout",
		`${opts.timeoutSec ?? 600}s`,
	];
	if (opts.schema) args.push("--json-schema", JSON.stringify(opts.schema));

	const proc = Bun.spawn(args, {
		cwd: opts.cwd,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, PATH },
	});

	// When signed out, agy prints a login URL and waits 60s for a code.
	// Spot that early and stop instead of hanging.
	let authRequired = false;
	const watch = async (stream: ReadableStream<Uint8Array>) => {
		let buf = "";
		const decoder = new TextDecoder();
		const reader = stream.getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buf += decoder.decode(value, { stream: true });
			if (!authRequired && /Authentication required|Waiting for authentication/i.test(buf)) {
				authRequired = true;
				proc.kill();
			}
		}
		return buf;
	};
	const [stdout, stderr] = await Promise.all([watch(proc.stdout), watch(proc.stderr)]);
	await proc.exited;

	if (authRequired) throw new AgentError(SIGN_IN_MESSAGE, "auth");

	const env = parseEnvelope(stdout);
	if (env?.status === "SUCCESS") {
		return { text: env.response ?? "", structured: env.structured_output ?? null };
	}
	const reason = env?.error || lastLine(stderr) || lastLine(stdout) || `agy exited with code ${proc.exitCode}`;
	console.error("agy failed:", proc.exitCode, reason, stderr.slice(-1500));
	if (/auth|sign in|log ?in|credential/i.test(reason)) throw new AgentError(SIGN_IN_MESSAGE, "auth");
	throw new AgentError(`Antigravity failed: ${reason.slice(0, 280)}`, "other");
}

function parseEnvelope(stdout: string): Envelope | null {
	const lines = stdout.trim().split("\n").reverse();
	for (const line of lines) {
		const t = line.trim();
		if (!t.startsWith("{")) continue;
		try {
			return JSON.parse(t) as Envelope;
		} catch {}
	}
	const start = stdout.indexOf("{");
	if (start >= 0) {
		try {
			return JSON.parse(stdout.slice(start)) as Envelope;
		} catch {}
	}
	return null;
}

function lastLine(s: string) {
	return s.trim().split("\n").filter(Boolean).pop()?.trim() ?? "";
}

/** Pull a JSON object out of a reply that may be wrapped in prose or fences. */
export function extractJson(text: string): unknown {
	const t = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
	const a = t.indexOf("{");
	const b = t.lastIndexOf("}");
	if (a < 0 || b < a) throw new AgentError("Antigravity didn't return a transcript.", "other");
	return JSON.parse(t.slice(a, b + 1));
}
