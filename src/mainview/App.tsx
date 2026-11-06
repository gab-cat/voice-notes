import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, Note, NoteSummary } from "../shared/types";
import { whenLabel } from "./format";
import { NoteList } from "./NoteList";
import { NoteView } from "./NoteView";
import { getNote, getState, listNotes, onFocus, onNote, onNotes, onState, setPinned } from "./rpc";
import { IconButton } from "./ui";

function useSystemTheme() {
	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const apply = () => document.documentElement.classList.toggle("dark", mq.matches);
		apply();
		mq.addEventListener("change", apply);
		return () => mq.removeEventListener("change", apply);
	}, []);
}

type View = { id: string | null; dir: number; n: number };

export default function App() {
	useSystemTheme();
	const [notes, setNotes] = useState<NoteSummary[] | null>(null);
	const [note, setNote] = useState<Note | null>(null);
	const [state, setAppState] = useState<AppState>({ pinned: true, downloadsBlocked: false, signedIn: null });
	const [view, setView] = useState<View>({ id: null, dir: 1, n: 0 });
	const [leaving, setLeaving] = useState<View | null>(null);
	const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
	const viewRef = useRef(view);
	viewRef.current = view;

	const go = useCallback(async (id: string | null) => {
		if (viewRef.current.id === id) return;
		// Load first so the note slides in with its content, not empty.
		if (id) {
			const n = await getNote(id).catch(() => null);
			if (!n) return;
			setNote(n);
		}
		const cur = viewRef.current;
		if (cur.id === id) return;
		const dir = id ? 1 : -1;
		setLeaving({ ...cur, dir });
		setView({ id, dir, n: cur.n + 1 });
		clearTimeout(leaveTimer.current);
		leaveTimer.current = setTimeout(() => setLeaving(null), 280);
	}, []);

	useEffect(() => {
		listNotes().then(setNotes).catch(() => setNotes([]));
		getState().then(setAppState).catch(() => {});
		const offs = [
			onNotes(setNotes),
			onState(setAppState),
			onNote((n) => {
				if (n.id === viewRef.current.id) setNote(n);
			}),
			onFocus((id) => go(id)),
		];
		return () => offs.forEach((off) => off());
	}, [go]);

	// Esc goes back to the list.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && viewRef.current.id) go(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [go]);

	const togglePin = async () => setAppState(await setPinned(!state.pinned));

	const render = (v: View) =>
		v.id ? (
			note && note.id === v.id ? (
				<NoteView note={note} />
			) : (
				<div />
			)
		) : (
			<NoteList notes={notes} state={state} onOpen={go} />
		);

	return (
		<div className="relative flex h-full flex-col overflow-clip">
			{/* Title bar: drag region, traffic lights sit in the left inset. */}
			<header className="electrobun-webkit-app-region-drag relative z-20 flex h-[52px] shrink-0 items-center justify-center px-3">
				{view.id ? (
					<div className="electrobun-webkit-app-region-no-drag absolute left-[78px]">
						<IconButton icon="back" label="All voice notes" onClick={() => go(null)} />
					</div>
				) : null}
				<h1 key={view.id ?? "list"} className="animate-swap text-[13px] font-semibold tracking-[-0.01em]">
					{view.id && note?.id === view.id ? whenLabel(note.received) : "Voice notes"}
				</h1>
				<div className="electrobun-webkit-app-region-no-drag absolute right-3">
					<IconButton
						icon="pin"
						label={state.pinned ? "Stop keeping on top" : "Keep on top"}
						active={state.pinned}
						onClick={() => void togglePin()}
					/>
				</div>
			</header>

			<main className="relative min-h-0 flex-1">
				{leaving && leaving.id !== view.id ? (
					<div
						key={`out-${leaving.id ?? "list"}`}
						aria-hidden
						className="animate-view-out pointer-events-none absolute inset-0"
						style={{ ["--dir" as string]: leaving.dir }}
					>
						{render(leaving)}
					</div>
				) : null}
				<div
					key={view.id ?? "list"}
					className={`h-full ${view.n > 0 ? "animate-view-in" : ""}`}
					style={{ ["--dir" as string]: view.dir }}
				>
					{render(view)}
				</div>
			</main>
		</div>
	);
}
