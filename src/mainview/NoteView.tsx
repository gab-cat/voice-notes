import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Note } from "../shared/types";
import { Chat } from "./Chat";
import { activeIndex, dirOf, estimateSpans, noteAsText, paragraphs, stamp, toSrt } from "./format";
import { IMPLODE_S, Listening } from "./Listening";
import { SignInCard } from "./NoteList";
import { type Playback, Player, usePlayback } from "./Player";
import { dismissError, setItem, transcribe } from "./rpc";
import { Button, CopyButton, Icon, Segmented, Spinner } from "./ui";

type Tab = "summary" | "transcript" | "chat";

const isPending = (n: Note) => n.status === "queued" || n.status === "processing";

// Keyed by note, so the audio and tab never carry over to another note.
export function NoteView({ note }: { note: Note }) {
	return <OneNote key={note.id} note={note} />;
}

function OneNote({ note }: { note: Note }) {
	const [tab, setTab] = useState<Tab>("summary");
	const done = note.status === "done";
	const playback = usePlayback(note.id, note.duration);

	// When a transcription finishes in view, the scene implodes over the result,
	// and the result builds in behind it as the light comes back.
	const prev = useRef(note);
	const [outro, setOutro] = useState<Note | null>(null);
	const [revealing, setRevealing] = useState(false);
	useLayoutEffect(() => {
		const was = prev.current;
		prev.current = note;
		if (was.id !== note.id || !isPending(was) || isPending(note)) return;
		setOutro(was);
		setRevealing(true);
		const a = setTimeout(() => setOutro(null), IMPLODE_S * 1000 + 60);
		const b = setTimeout(() => setRevealing(false), IMPLODE_S * 1000 + 2000);
		return () => {
			clearTimeout(a);
			clearTimeout(b);
		};
	}, [note]);

	if (isPending(note)) return <Listening note={note} />;

	return (
		<div className={`relative flex h-full flex-col ${revealing ? "reveal" : ""}`}>
			{outro ? (
				<div className="pointer-events-none absolute inset-0 z-30">
					<Listening note={outro} leaving />
				</div>
			) : null}
			<div className="shrink-0 space-y-3 px-4 pt-1">
				<div data-reveal style={{ ["--r" as string]: 0 }}>
					<Player playback={playback} />
				</div>
				{done && note.error ? <RetryFailed note={note} /> : null}
				{done ? (
					<div data-reveal className="flex items-center justify-between" style={{ ["--r" as string]: 1 }}>
						<Segmented
							label="Sections"
							value={tab}
							onChange={setTab}
							options={[
								{ value: "summary", label: "Summary" },
								{ value: "transcript", label: "Transcript" },
								{ value: "chat", label: "Chat" },
							]}
						/>
						{note.language ? <span className="text-[11.5px] text-ink-3">{note.language}</span> : null}
					</div>
				) : null}
			</div>

			<div className="relative min-h-0 flex-1">
				{!done ? (
					<Pending note={note} />
				) : tab === "chat" ? (
					<Chat key={note.id} note={note} />
				) : (
					<div key={tab} className="animate-swap scroll-soft h-full overflow-y-auto px-4 pb-5 pt-4">
						{tab === "summary" ? (
							<Summary note={note} reveal={revealing} />
						) : (
							<Transcript note={note} playback={playback} />
						)}
					</div>
				)}
			</div>
		</div>
	);
}

/** The summary's words, each arriving a beat after the last. */
function Words({ text }: { text: string }) {
	let n = 0;
	return (
		<>
			{text.split(/(\s+)/).map((w, i) =>
				!w.trim() ? (
					w
				) : (
					<span key={i} className="reveal-word" style={{ ["--w" as string]: Math.min(n++, 60) }}>
						{w}
					</span>
				),
			)}
		</>
	);
}

function Summary({ note, reveal }: { note: Note; reveal: boolean }) {
	// To-dos come in once most of the summary's words have arrived.
	const later = 3 + Math.min(Math.ceil(note.summary.split(/\s+/).length / 10), 6);
	return (
		<div className="space-y-5">
			<div>
				<div data-reveal className="-mt-1 mb-2 flex justify-end gap-1" style={{ ["--r" as string]: 2 }}>
					<CopyButton text={noteAsText(note, false)} label="Copy summary" />
					<CopyButton text={noteAsText(note, true)} label="Copy with transcript" />
				</div>
				<p className="selectable text-[14px] leading-[1.55]">{reveal ? <Words text={note.summary} /> : note.summary}</p>
			</div>

			{note.actionItems.length ? (
				<section className="animate-rise" style={{ ["--i" as string]: 1 }}>
					<h2 data-reveal className="mb-1.5 text-[13px] font-semibold" style={{ ["--r" as string]: later }}>
						To do
					</h2>
					<ul className="panel divide-y divide-line/70 overflow-hidden" data-reveal style={{ ["--r" as string]: later + 0.5 }}>
						{note.actionItems.map((item, i) => (
							<li key={i} data-reveal style={{ ["--r" as string]: later + 1 + i * 0.6 }}>
								<label className="press-soft flex cursor-pointer items-start gap-2.5 px-3 py-2.5 hover:bg-ink/[0.035]">
									<input
										type="checkbox"
										checked={item.done}
										onChange={(e) => void setItem(note.id, i, e.target.checked)}
										className="peer sr-only"
									/>
									<span
										className={`mt-[1px] grid h-[16px] w-[16px] shrink-0 place-items-center rounded-[5px] ring-1 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${
											item.done ? "bg-accent text-accent-ink ring-accent" : "ring-ink/25"
										}`}
									>
										{item.done ? <Icon name="check" size={12} /> : null}
									</span>
									<span
										className={`text-[13px] leading-[1.45] transition-colors duration-200 ${
											item.done ? "text-ink-3 line-through" : ""
										}`}
									>
										{item.text}
									</span>
								</label>
							</li>
						))}
					</ul>
				</section>
			) : null}

			{note.questions.length ? (
				<section
					className="animate-rise"
					data-reveal
					style={{ ["--i" as string]: 2, ["--r" as string]: later + 1.5 + note.actionItems.length * 0.6 }}
				>
					<h2 className="mb-1.5 text-[13px] font-semibold">They asked</h2>
					<ul className="selectable space-y-1.5 text-[13px] leading-[1.45]">
						{note.questions.map((q, i) => (
							<li key={i} className="flex gap-2">
								<span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink/40" />
								{q}
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}

function Transcript({ note, playback }: { note: Note; playback: Playback }) {
	const [lang, setLang] = useState<"original" | "english">("original");
	const english = lang === "english" && !!note.english;
	const text = english ? note.english : note.transcript;
	const timed = note.segments.length > 0;
	const [adding, setAdding] = useState(false);

	return (
		<div>
			<div className="mb-3 flex items-center justify-between gap-2">
				{note.english ? (
					<Segmented
						size="sm"
						label="Transcript language"
						value={lang}
						onChange={setLang}
						options={[
							{ value: "original", label: "Original" },
							{ value: "english", label: "English" },
						]}
					/>
				) : (
					<span />
				)}
				<div className="flex items-center gap-1">
					{timed ? (
						<CopyButton
							text={toSrt(note.segments.map((s) => ({ ...s, text: english ? s.english || s.text : s.text })))}
							label="Copy SRT"
						/>
					) : (
						<button
							onClick={async () => {
								setAdding(true);
								await transcribe(note.id, true).finally(() => setAdding(false));
							}}
							disabled={adding}
							title="Transcribe again with a time for each line"
							className="press inline-flex h-[24px] items-center gap-1 rounded-[6px] px-2 text-[11.5px] font-medium text-ink-2 hover:bg-ink/[0.07] hover:text-ink disabled:opacity-50"
						>
							{adding ? <Spinner size={12} /> : <Icon name="clock" size={13} />}
							Add timings
						</button>
					)}
					<CopyButton text={text} />
				</div>
			</div>
			<div key={lang} className="animate-swap">
				{timed ? (
					<TimedLines note={note} english={english} playback={playback} />
				) : (
					<Paragraphs text={text} playback={playback} />
				)}
			</div>
		</div>
	);
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Keeps the line being spoken in view while the audio plays. */
function useFollow(index: number, playing: boolean) {
	const rows = useRef<(HTMLElement | null)[]>([]);
	useEffect(() => {
		if (!playing || index < 0) return;
		const el = rows.current[index];
		const box = el?.closest(".scroll-soft");
		if (!el || !box) return;
		const r = el.getBoundingClientRect();
		const b = box.getBoundingClientRect();
		if (r.top >= b.top + 8 && r.bottom <= b.bottom - 24) return;
		el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
	}, [index, playing]);
	return rows;
}

function TimedLines({ note, english, playback }: { note: Note; english: boolean; playback: Playback }) {
	const current = playback.started ? activeIndex(note.segments, playback.time) : -1;
	const rows = useFollow(current, playback.playing);

	return (
		<ol className="selectable -mx-2 space-y-0.5">
			{note.segments.map((s, i) => {
				const words = english ? s.english || s.text : s.text;
				const on = i === current;
				return (
					<li
						key={i}
						ref={(el) => {
							rows.current[i] = el;
						}}
						aria-current={on ? "true" : undefined}
						onClick={() => {
							// Tapping a line plays from there, unless you were selecting text.
							if (window.getSelection()?.isCollapsed !== false) void playback.seekTo(s.start);
						}}
						className={`animate-rise flex cursor-pointer gap-2.5 rounded-[6px] px-2 py-1.5 transition-colors duration-300 ${
							on ? "bg-accent/[0.12]" : "hover:bg-ink/[0.04]"
						}`}
						style={{ ["--i" as string]: Math.min(i, 12) }}
					>
						<button
							onClick={(e) => {
								e.stopPropagation();
								void playback.seekTo(s.start);
							}}
							aria-label={`Play from ${stamp(s.start)}`}
							className={`press tabular mt-[3px] h-[18px] w-[38px] shrink-0 rounded-[4px] text-left font-mono text-[11px] transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent/70 ${
								on ? "text-accent" : "text-ink-3 hover:text-ink"
							}`}
						>
							{stamp(s.start)}
						</button>
						<span dir={dirOf(words)} className="text-[14px] leading-[1.6]">
							{words}
						</span>
					</li>
				);
			})}
		</ol>
	);
}

function Paragraphs({ text, playback }: { text: string; playback: Playback }) {
	const paras = useMemo(() => paragraphs(text), [text]);
	// Without timings the paragraph is a best guess from its length.
	const spans = useMemo(() => estimateSpans(paras, playback.total), [paras, playback.total]);
	const current = playback.started && playback.total ? activeIndex(spans, playback.time) : -1;
	const rows = useFollow(current, playback.playing);

	return (
		<div className="selectable -mx-2 space-y-1.5 text-[14px] leading-[1.65]">
			{paras.map((p, i) => (
				<p
					key={i}
					ref={(el) => {
						rows.current[i] = el;
					}}
					dir={dirOf(p)}
					aria-current={i === current ? "true" : undefined}
					className={`rounded-[6px] px-2 py-1 transition-colors duration-500 ${i === current ? "bg-accent/[0.1]" : ""}`}
				>
					{p}
				</p>
			))}
		</div>
	);
}

/** A second transcription failed; the earlier one is still shown below. */
function RetryFailed({ note }: { note: Note }) {
	const [busy, setBusy] = useState<"retry" | "dismiss" | null>(null);
	return (
		<div role="alert" className="animate-rise rounded-[8px] bg-danger/10 px-3 py-2.5">
			<p className="text-[12.5px] font-medium leading-[1.45]">Couldn't transcribe again. The earlier transcript is kept.</p>
			<p className="mt-0.5 text-[12px] leading-[1.45]">{note.error}</p>
			<div className="mt-2 flex gap-2">
				<Button
					icon="retry"
					busy={busy === "retry"}
					onClick={async () => {
						setBusy("retry");
						await transcribe(note.id).finally(() => setBusy(null));
					}}
				>
					Try again
				</Button>
				<Button
					busy={busy === "dismiss"}
					onClick={async () => {
						setBusy("dismiss");
						await dismissError(note.id).finally(() => setBusy(null));
					}}
				>
					Dismiss
				</Button>
			</div>
		</div>
	);
}

function Pending({ note }: { note: Note }) {
	const [busy, setBusy] = useState(false);
	const run = async () => {
		setBusy(true);
		await transcribe(note.id).finally(() => setBusy(false));
	};

	if (note.status === "error" && note.errorKind === "auth") {
		return (
			<div className="pt-4">
				<SignInCard />
			</div>
		);
	}

	return (
		<div className="animate-rise px-4 pt-4">
			<div className="panel p-3.5">
				<p className="text-[13px] leading-[1.5]">
					{note.status === "error" ? note.error : "This voice note was in Downloads before the app started."}
				</p>
				<div className="mt-3">
					<Button tone="accent" icon={note.status === "error" ? "retry" : undefined} busy={busy} onClick={() => void run()}>
						{note.status === "error" ? "Try again" : "Transcribe"}
					</Button>
				</div>
			</div>
		</div>
	);
}
