import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Note } from "../shared/types";
import { markdown } from "./format";
import { sendChat } from "./rpc";
import { CopyButton, Icon } from "./ui";

const SHORTCUTS = ["Draft a reply", "Reply in English", "What's urgent?", "Make a task list"];

/**
 * Wraps each word of a rendered reply in a span that fades up a beat after
 * the one before, so the reply writes itself in. Code blocks come in whole.
 * Returns how long the whole reply takes, in ms.
 */
function writeIn(root: HTMLElement): number {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const texts: Text[] = [];
	while (walker.nextNode()) {
		const t = walker.currentNode as Text;
		if (!t.parentElement?.closest("pre")) texts.push(t);
	}
	const total = texts.reduce((n, t) => n + (t.data.match(/\S+/g)?.length ?? 0), 0);
	// Quick for short replies, never longer than about 1.4 s for long ones.
	const step = Math.min(22, 1400 / Math.max(1, total));
	let n = 0;
	for (const t of texts) {
		const frag = document.createDocumentFragment();
		for (const part of t.data.split(/(\s+)/)) {
			if (!part) continue;
			if (!part.trim()) {
				frag.append(part);
				continue;
			}
			const word = document.createElement("span");
			word.className = "reply-word";
			word.style.setProperty("--d", `${Math.round(n++ * step)}ms`);
			word.textContent = part;
			frag.append(word);
		}
		t.replaceWith(frag);
	}
	for (const pre of root.querySelectorAll("pre")) {
		pre.classList.add("reply-word");
		pre.style.setProperty("--d", `${Math.round(n++ * step)}ms`);
	}
	// A list bullet comes in with its item's first word, not before it.
	for (const li of root.querySelectorAll("li")) {
		const first = li.querySelector<HTMLElement>(".reply-word");
		if (!first) continue;
		li.classList.add("reply-li");
		li.style.setProperty("--d", first.style.getPropertyValue("--d"));
	}
	return n * step + 560;
}

export function Chat({ note }: { note: Note }) {
	const [draft, setDraft] = useState("");
	const [pending, setPending] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const list = useRef<HTMLDivElement>(null);
	const input = useRef<HTMLTextAreaElement>(null);
	const latest = useRef<HTMLDivElement>(null);
	// Messages from before this chat opened appear as they are; only new
	// ones animate.
	const seen = useRef(note.chat.length);
	// Chat length when the last message was sent: once the saved copy of it
	// arrives, the pending bubble steps aside without a second animation.
	const sentAt = useRef(note.chat.length);
	const echoed = pending !== null && note.chat.length > sentAt.current;

	useLayoutEffect(() => {
		const box = list.current;
		if (!box) return;
		// A long new reply is read from its first line, not its last.
		const reply = latest.current;
		if (reply && reply.offsetHeight > box.clientHeight - 48) {
			box.scrollTo({ top: reply.offsetTop - 12, behavior: "smooth" });
		} else {
			box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
		}
	}, [note.chat.length, pending, error]);

	useEffect(() => {
		const ta = input.current;
		if (!ta) return;
		ta.style.height = "auto";
		ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
	}, [draft]);

	async function send(text: string) {
		const message = text.trim();
		if (!message || pending) return;
		sentAt.current = note.chat.length;
		setPending(message);
		setError(null);
		setDraft("");
		try {
			await sendChat(note.id, message); // the updated note arrives via noteChanged
		} catch (err) {
			setError((err as Error).message || "Antigravity didn't answer.");
			setDraft(message);
		} finally {
			setPending(null);
			input.current?.focus();
		}
	}

	const empty = !note.chat.length && !pending && !error;
	return (
		<div className="flex h-full flex-col">
			<div ref={list} className="scroll-soft relative min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-4">
				{empty ? (
					<p className="animate-swap px-1 pt-2 text-[12.5px] leading-[1.5]">
						Ask anything about this voice note, or start with one of the options below.
					</p>
				) : null}
				{note.chat.map((m, i) => {
					const fresh = i >= seen.current;
					const last = i === note.chat.length - 1;
					return m.role === "me" ? (
						// A new message of yours was already shown while pending.
						<Mine key={i} text={m.text} animate={false} />
					) : (
						<Reply key={i} ref={fresh && last ? latest : undefined} text={m.text} fresh={fresh} />
					);
				})}
				{pending && !echoed ? (
					<>
						<Mine text={pending} animate />
						<div className="typing animate-fade flex gap-1 px-1 py-2" aria-label="Antigravity is replying">
							{[0, 1, 2].map((i) => (
								<i key={i} className="h-1.5 w-1.5 rounded-full bg-ink/50" style={{ ["--i" as string]: i }} />
							))}
						</div>
					</>
				) : null}
				{error ? (
					<p className="animate-rise rounded-[8px] bg-danger/10 px-3 py-2 text-[12.5px] leading-[1.45]">{error}</p>
				) : null}
			</div>

			<div className="shrink-0 border-t border-line/70 px-3 pb-3 pt-2.5">
				<div className="no-scrollbar -mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3">
					{SHORTCUTS.map((s) => (
						<button
							key={s}
							disabled={!!pending}
							onClick={() => void send(s)}
							className="press shrink-0 rounded-[7px] bg-ink/[0.05] px-2.5 py-1 text-[12px] font-medium hover:bg-ink/[0.09] disabled:opacity-40"
						>
							{s}
						</button>
					))}
				</div>
				<form
					className="flex items-end gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						void send(draft);
					}}
				>
					<textarea
						ref={input}
						rows={1}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
								e.preventDefault();
								void send(draft);
							}
						}}
						placeholder="Message Antigravity"
						className="selectable min-h-[34px] flex-1 resize-none rounded-[8px] bg-surface px-3 py-[7px] text-[13px] leading-[1.45] ring-1 ring-line transition-shadow placeholder:text-ink-3 focus:ring-accent/70"
					/>
					<button
						type="submit"
						aria-label="Send"
						disabled={!draft.trim() || !!pending}
						className="press grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[8px] bg-accent text-accent-ink hover:brightness-105 disabled:opacity-35"
					>
						<Icon name="send" size={16} />
					</button>
				</form>
			</div>
		</div>
	);
}

function Mine({ text, animate }: { text: string; animate: boolean }) {
	return (
		<div className={`flex justify-end ${animate ? "animate-send" : ""}`}>
			<p className="selectable max-w-[85%] whitespace-pre-wrap rounded-[8px] bg-accent/[0.14] px-3 py-2 text-[13px] leading-[1.45]">
				{text}
			</p>
		</div>
	);
}

const Reply = forwardRef<HTMLDivElement, { text: string; fresh: boolean }>(function Reply({ text, fresh }, ref) {
	const body = useRef<HTMLDivElement>(null);
	const [copyDelay, setCopyDelay] = useState(0);
	const html = useMemo(() => markdown(text), [text]);

	// Before the first paint, so the finished reply never flashes up first.
	useLayoutEffect(() => {
		if (!fresh || !body.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		setCopyDelay(writeIn(body.current));
		// Only on arrival; a later re-render keeps the words as they are.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div ref={ref} className="group px-1">
			<div ref={body} className="prose-chat selectable text-[13px] leading-[1.55]" dangerouslySetInnerHTML={{ __html: html }} />
			<div
				className={`mt-1 -ml-2 ${fresh ? "animate-rise" : ""}`}
				style={fresh ? { animationDelay: `${copyDelay}ms` } : undefined}
			>
				<CopyButton text={text} />
			</div>
		</div>
	);
});
