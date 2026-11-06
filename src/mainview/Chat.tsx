import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Note } from "../shared/types";
import { markdown } from "./format";
import { sendChat } from "./rpc";
import { CopyButton, Icon } from "./ui";

const SHORTCUTS = ["Draft a reply", "Reply in English", "What's urgent?", "Make a task list"];

export function Chat({ note }: { note: Note }) {
	const [draft, setDraft] = useState("");
	const [pending, setPending] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const list = useRef<HTMLDivElement>(null);
	const input = useRef<HTMLTextAreaElement>(null);

	useLayoutEffect(() => {
		list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
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
			<div ref={list} className="scroll-soft min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-4">
				{empty ? (
					<p className="animate-swap px-1 pt-2 text-[12.5px] leading-[1.5]">
						Ask anything about this voice note, or start with one of the options below.
					</p>
				) : null}
				{note.chat.map((m, i) =>
					m.role === "me" ? <Mine key={i} text={m.text} /> : <Reply key={i} text={m.text} />,
				)}
				{pending ? (
					<>
						<Mine text={pending} />
						<div className="typing flex gap-1 px-1 py-2" aria-label="Antigravity is replying">
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

function Mine({ text }: { text: string }) {
	return (
		<div className="animate-rise flex justify-end">
			<p className="selectable max-w-[85%] whitespace-pre-wrap rounded-[8px] bg-accent/[0.14] px-3 py-2 text-[13px] leading-[1.45]">
				{text}
			</p>
		</div>
	);
}

function Reply({ text }: { text: string }) {
	return (
		<div className="animate-rise group px-1">
			<div
				className="prose-chat selectable text-[13px] leading-[1.55]"
				dangerouslySetInnerHTML={{ __html: markdown(text) }}
			/>
			<div className="mt-1 -ml-2">
				<CopyButton text={text} />
			</div>
		</div>
	);
}
