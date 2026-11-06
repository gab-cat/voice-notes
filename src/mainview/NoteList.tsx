import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AppInfo, AppState, NoteSummary, SearchHit } from "../shared/types";
import { UpdateBanner, VersionFooter } from "./Updates";
import { clock, dayLabel, timeLabel } from "./format";
import { openSignIn, retryAuthFailed, searchNotes } from "./rpc";
import { Bars, Button, Icon } from "./ui";

export function SignInCard() {
	const [retrying, setRetrying] = useState(false);
	return (
		<div className="panel animate-rise mx-4 mb-3 p-3.5">
			<p className="text-[13px] font-medium">Sign in to Antigravity to transcribe voice notes.</p>
			<p className="mt-1 text-[12.5px] leading-[1.5] text-ink">
				A Terminal window opens. Sign in with Google, paste the code there, then come back.
			</p>
			<div className="mt-3 flex gap-2">
				<Button tone="accent" icon="key" onClick={() => void openSignIn()}>
					Sign in
				</Button>
				<Button
					icon="retry"
					busy={retrying}
					onClick={async () => {
						setRetrying(true);
						await retryAuthFailed().finally(() => setRetrying(false));
					}}
				>
					Try again
				</Button>
			</div>
		</div>
	);
}

const termsOf = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

/** Search over transcripts in the app, plus the date and time shown in the list. */
function useSearch(query: string, notes: NoteSummary[] | null) {
	const [hits, setHits] = useState<Map<string, string> | null>(null);
	const seq = useRef(0);

	useEffect(() => {
		const terms = termsOf(query);
		if (!terms.length || !notes) {
			setHits(null);
			return;
		}
		const n = ++seq.current;
		const t = setTimeout(async () => {
			const found: SearchHit[] = await searchNotes(query).catch(() => []);
			if (n !== seq.current) return;
			const map = new Map(found.map((h) => [h.id, h.snippet]));
			for (const note of notes) {
				const when = `${dayLabel(note.received)} ${timeLabel(note.received)}`.toLowerCase();
				if (!map.has(note.id) && terms.every((term) => when.includes(term))) map.set(note.id, "");
			}
			setHits(map);
		}, 90);
		return () => clearTimeout(t);
	}, [query, notes]);

	return hits;
}

/** The query's words marked in the text. */
function highlight(text: string, terms: string[]): ReactNode {
	if (!terms.length) return text;
	const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
	return parts.map((part, i) =>
		i % 2 ? (
			<mark key={i} className="rounded-[3px] bg-accent/25 px-[1px] text-ink">
				{part}
			</mark>
		) : (
			part
		),
	);
}

export function NoteList({
	notes,
	state,
	appInfo,
	onOpen,
}: {
	notes: NoteSummary[] | null;
	state: AppState;
	appInfo: AppInfo;
	onOpen: (id: string) => void;
}) {
	const [query, setQuery] = useState("");
	const field = useRef<HTMLInputElement>(null);
	const hits = useSearch(query, notes);
	const terms = useMemo(() => termsOf(query), [query]);
	const searching = terms.length > 0;
	const shown = notes && hits ? notes.filter((n) => hits.has(n.id)) : notes;

	// ⌘F jumps to search.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
				e.preventDefault();
				field.current?.focus();
				field.current?.select();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<div className="flex h-full flex-col">
			{notes?.length ? (
				<div className="animate-rise shrink-0 px-4 pb-2 pt-1">
					<label className="group relative block">
						<span className="sr-only">Search voice notes</span>
						<Icon
							name="search"
							size={15}
							className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2 transition-colors duration-200 group-focus-within:text-accent"
						/>
						<input
							ref={field}
							type="text"
							value={query}
							spellCheck={false}
							placeholder="Search voice notes"
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key !== "Escape") return;
								e.stopPropagation();
								if (query) setQuery("");
								else field.current?.blur();
							}}
							className="selectable h-[34px] w-full rounded-[8px] bg-ink/[0.05] pl-8 pr-8 text-[13px] text-ink ring-1 ring-transparent transition-[box-shadow,background-color] duration-200 placeholder:text-ink-3 hover:bg-ink/[0.07] focus:bg-surface focus:ring-accent/60 dark:bg-ink/[0.06]"
						/>
						{query ? (
							<button
								type="button"
								aria-label="Clear search"
								onClick={() => {
									setQuery("");
									field.current?.focus();
								}}
								className="press animate-fade absolute right-1.5 top-1/2 grid h-[22px] w-[22px] -translate-y-1/2 place-items-center rounded-[6px] text-ink-2 hover:bg-ink/[0.08] hover:text-ink"
							>
								<Icon name="close" size={13} />
							</button>
						) : null}
					</label>
				</div>
			) : null}

			<div className="scroll-soft flex min-h-0 flex-1 flex-col overflow-y-auto pb-4 pt-1 [&>*]:shrink-0">
				{searching ? null : (
					<>
						<UpdateBanner info={appInfo} />
						{state.downloadsWaiting ? (
							<div className="panel animate-rise mx-4 mb-3 p-3.5 text-[12.5px] leading-[1.5]">
								macOS is asking whether Voice Notes can open {state.watchName}. Click Allow so it can find
								voice notes.
							</div>
						) : null}
						{state.downloadsBlocked ? (
							<div className="panel mx-4 mb-3 p-3.5 text-[12.5px] leading-[1.5]">
								macOS is blocking access to {state.watchName}. Allow it in System Settings, Privacy &
								Security, Files and Folders.
							</div>
						) : null}
						{state.signedIn === false ? <SignInCard /> : null}
					</>
				)}

				{notes === null ? (
					<div className="panel mx-4 divide-y divide-line/70 overflow-hidden">
						{[0, 1, 2, 3, 4].map((i) => (
							<div key={i} className="px-3.5 py-3">
								<div className="flex justify-between">
									<div className="skeleton h-[13px] w-[96px]" />
									<div className="skeleton h-[13px] w-[30px]" />
								</div>
								<div className="skeleton mt-2 h-[12px] w-[85%]" />
							</div>
						))}
					</div>
				) : notes.length === 0 ? (
					<Empty />
				) : (
					<>
						<Rows
							notes={shown ?? []}
							render={(n) => <Row note={n} snippet={hits?.get(n.id) ?? ""} terms={terms} onOpen={onOpen} />}
						/>
						{shown && shown.length === 0 ? (
							<div key={query} className="animate-swap px-8 pt-10 text-center">
								<p className="text-[13.5px] font-medium">No voice notes match “{query.trim()}”</p>
								<p className="mt-1 text-[12.5px] leading-[1.5]">
									Search looks through summaries, transcripts, to-dos and dates.
								</p>
								<div className="mt-3">
									<Button onClick={() => setQuery("")}>Clear search</Button>
								</div>
							</div>
						) : null}
					</>
				)}
				{searching ? null : (
					<div className="mt-auto">
						<VersionFooter info={appInfo} />
					</div>
				)}
			</div>
		</div>
	);
}

type Presence = "stay" | "enter" | "leave";
type Entry = { note: NoteSummary; presence: Presence };

/**
 * Keeps rows that just dropped out of the list (a search, a delete) on
 * screen while they leave, in the place they were.
 */
function merge(prev: Entry[], next: NoteSummary[]): Entry[] {
	const before = new Map(prev.map((e) => [e.note.id, e]));
	const nextIds = new Set(next.map((n) => n.id));
	const result: Entry[] = next.map((note) => {
		const was = before.get(note.id);
		return { note, presence: was && was.presence !== "leave" ? "stay" : "enter" };
	});
	prev.forEach((e, i) => {
		if (nextIds.has(e.note.id)) return;
		// After the nearest row above it that is still shown.
		let at = 0;
		for (let j = i - 1; j >= 0; j--) {
			const k = result.findIndex((r) => r.note.id === prev[j].note.id);
			if (k >= 0) {
				at = k + 1;
				break;
			}
		}
		result.splice(at, 0, { note: e.note, presence: "leave" });
	});
	return result;
}

/**
 * The list, animated as it changes: rows that leave fade and fold away,
 * rows that arrive open up and fade in one after another, and the rows in
 * between slide to their new places as the space changes.
 */
function Rows({ notes, render }: { notes: NoteSummary[]; render: (n: NoteSummary) => ReactNode }) {
	const [entries, setEntries] = useState<Entry[]>(() => notes.map((note) => ({ note, presence: "stay" })));
	const [from, setFrom] = useState(notes);
	if (from !== notes) {
		setFrom(notes);
		setEntries((prev) => merge(prev, notes));
	}

	if (!entries.length) return null;
	let entering = 0;
	return (
		<ul className="panel mx-4 divide-y divide-line/70 overflow-hidden">
			{entries.map((e, i) => (
				<AnimatedRow
					key={e.note.id}
					presence={e.presence}
					first={i}
					order={e.presence === "enter" ? entering++ : 0}
					onLeft={() =>
						setEntries((list) => list.filter((x) => !(x.note.id === e.note.id && x.presence === "leave")))
					}
				>
					{render(e.note)}
				</AnimatedRow>
			))}
		</ul>
	);
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function AnimatedRow({
	presence,
	first,
	order,
	onLeft,
	children,
}: {
	presence: Presence;
	first: number;
	order: number;
	onLeft: () => void;
	children: ReactNode;
}) {
	const ref = useRef<HTMLLIElement>(null);
	// Rows there when the list first loads use the page's own entrance.
	const initial = useRef(presence === "stay");
	const leftRef = useRef(onLeft);
	leftRef.current = onLeft;

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			if (presence === "leave") leftRef.current();
			return;
		}
		if (presence === "leave") {
			const a = el.animate(
				[
					{ height: `${el.offsetHeight}px`, opacity: 1, filter: "blur(0)" },
					{ height: "0px", opacity: 0, filter: "blur(4px)", borderTopWidth: "0px" },
				],
				{ duration: 260, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
			);
			a.onfinish = () => leftRef.current();
			return () => a.cancel();
		}
		if (presence === "enter") {
			const h = el.offsetHeight;
			const a = el.animate(
				[
					{ height: "0px", opacity: 0, transform: "translateY(6px)", filter: "blur(5px)" },
					{ height: `${h}px`, opacity: 1, transform: "none", filter: "blur(0)" },
				],
				{ duration: 380, delay: Math.min(order, 6) * 35, easing: EASE, fill: "backwards" },
			);
			return () => a.cancel();
		}
	}, [presence]);

	return (
		<li
			ref={ref}
			aria-hidden={presence === "leave" || undefined}
			className={`overflow-hidden ${initial.current ? "animate-rise" : ""} ${
				presence === "leave" ? "pointer-events-none" : ""
			}`}
			style={{ ["--i" as string]: Math.min(first, 10) }}
		>
			{children}
		</li>
	);
}

/**
 * One voice note in the list. Each state reads differently at a glance:
 * - unread transcript: a violet dot, a bolder time and the summary at full strength
 * - read transcript: the summary muted
 * - transcribing: a pulsing violet dot and a light sweeping through the row
 * - waiting: a violet ring
 * - not transcribed: a grey ring
 * - failed: a red dot, the reason in red
 * - needs sign-in: an amber dot
 */
function Row({
	note,
	snippet,
	terms,
	onOpen,
}: {
	note: NoteSummary;
	snippet: string;
	terms: string[];
	onOpen: (id: string) => void;
}) {
	const done = note.status === "done";
	const unread = done && !note.readAt;
	const when = `${dayLabel(note.received)}, ${timeLabel(note.received)}`;

	return (
		<button
			onClick={() => onOpen(note.id)}
			aria-label={unread ? `${when}, unread` : undefined}
			className={`press-soft relative block w-full px-3.5 py-3 text-left transition-colors duration-200 hover:bg-ink/[0.035] active:bg-ink/[0.06] focus-visible:bg-ink/[0.05] ${
				note.status === "processing" ? "row-scan" : ""
			}`}
		>
			<div className="flex items-baseline justify-between gap-3">
				<span className={`flex items-center gap-2 text-[13px] ${unread ? "font-semibold" : "font-medium"}`}>
					{unread ? <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" /> : null}
					<span>{highlight(when, terms)}</span>
				</span>
				<span className="tabular shrink-0 font-mono text-[11.5px] text-ink-3">{clock(note.duration)}</span>
			</div>

			{done ? (
				<p className={`mt-1 line-clamp-2 text-[12.5px] leading-[1.45] ${unread ? "text-ink" : "text-ink-2"}`}>
					{snippet ? (
						<span className="italic">{highlight(snippet, terms)}</span>
					) : (
						highlight(note.summary, terms)
					)}
				</p>
			) : (
				<Status note={note} />
			)}
		</button>
	);
}

function Status({ note }: { note: NoteSummary }) {
	const auth = note.status === "error" && note.errorKind === "auth";
	const [dot, label, text] =
		note.status === "processing"
			? ["animate-pulse-dot bg-accent", "Transcribing", "text-ink"]
			: note.status === "queued"
				? ["ring-[1.5px] ring-inset ring-accent", "Waiting to transcribe", "text-ink-2"]
				: note.status === "new"
					? ["ring-[1.5px] ring-inset ring-ink/35", "Not transcribed", "text-ink-2"]
					: auth
						? ["bg-warn", "Needs sign-in", "text-warn"]
						: ["bg-danger", "Couldn't transcribe", "text-danger"];
	return (
		<p className={`mt-1 flex items-center gap-2 text-[12.5px] ${text}`}>
			<span aria-hidden className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`} />
			{label}
		</p>
	);
}

function Empty() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center px-10 pb-12 text-center" style={{ flexShrink: 1 }}>
			<Bars heights={[10, 18, 28, 16, 24, 34, 20, 12, 22, 14]} className="animate-rise text-ink/20" />
			<h2 className="animate-rise mt-5 text-[15px] font-semibold" style={{ ["--i" as string]: 1 }}>
				No voice notes yet
			</h2>
			<p className="animate-rise mt-1.5 text-[12.5px] leading-[1.5]" style={{ ["--i" as string]: 2 }}>
				Download a voice note in WhatsApp and it opens here, transcribed.
			</p>
		</div>
	);
}
