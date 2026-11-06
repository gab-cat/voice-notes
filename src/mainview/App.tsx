import { useCallback, useEffect, useRef, useState } from "react";
import type { AppInfo, AppState, Note, NoteSummary } from "../shared/types";
import { whenLabel } from "./format";
import { NoteList } from "./NoteList";
import { NoteView } from "./NoteView";
import {
	deleteNote,
	getAppInfo,
	getNote,
	getState,
	listNotes,
	onAppInfo,
	onFocus,
	onNote,
	onNotes,
	onState,
	setPinned,
	takeFocus,
	transcribe,
} from "./rpc";
import { Settings } from "./Settings";
import { Button, Icon, IconButton } from "./ui";

function useSystemTheme() {
	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const apply = () => document.documentElement.classList.toggle("dark", mq.matches);
		apply();
		mq.addEventListener("change", apply);
		return () => mq.removeEventListener("change", apply);
	}, []);
}

/** Marks scrolled lists so their top edge feathers out under the title bar. */
function useScrollEdges() {
	useEffect(() => {
		const onScroll = (e: Event) => {
			const el = e.target;
			if (!(el instanceof HTMLElement) || !el.classList.contains("scroll-soft")) return;
			const scrolled = String(el.scrollTop > 4);
			if (el.dataset.scrolled !== scrolled) el.dataset.scrolled = scrolled;
		};
		document.addEventListener("scroll", onScroll, { capture: true, passive: true });
		return () => document.removeEventListener("scroll", onScroll, { capture: true });
	}, []);
}

type Page = "list" | "note" | "settings";
type View = { page: Page; id: string | null; dir: number; n: number };
const keyOf = (v: { page: Page; id: string | null }) => (v.page === "note" ? `note-${v.id}` : v.page);

export default function App() {
	useSystemTheme();
	useScrollEdges();
	const [notes, setNotes] = useState<NoteSummary[] | null>(null);
	const [note, setNote] = useState<Note | null>(null);
	const [state, setAppState] = useState<AppState>({
		pinned: true,
		watchName: "Downloads",
		downloadsBlocked: false,
		downloadsWaiting: false,
		signedIn: null,
	});
	const [appInfo, setAppInfo] = useState<AppInfo>({
		version: "",
		channel: "",
		updatePhase: "idle",
		updateProgress: null,
		availableVersion: null,
		updateReady: false,
		error: null,
	});
	const [view, setView] = useState<View>({ page: "list", id: null, dir: 1, n: 0 });
	const [leaving, setLeaving] = useState<View | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
	const [saved, setSaved] = useState(0);
	const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
	const toastTimer = useRef<ReturnType<typeof setTimeout>>();
	const viewRef = useRef(view);
	viewRef.current = view;

	const show = useCallback(async (page: Page, id: string | null = null) => {
		const cur = viewRef.current;
		if (cur.page === page && cur.id === id) return;
		// Load first so the note slides in with its content, not empty.
		if (page === "note" && id) {
			const n = await getNote(id).catch(() => null);
			if (!n) return;
			setNote(n);
		}
		const now = viewRef.current;
		if (now.page === page && now.id === id) return;
		const dir = page === "list" ? -1 : 1;
		setConfirming(false);
		setLeaving({ ...now, dir });
		setView({ page, id, dir, n: now.n + 1 });
		clearTimeout(leaveTimer.current);
		leaveTimer.current = setTimeout(() => setLeaving(null), 140);
	}, []);
	const open = useCallback((id: string) => show("note", id), [show]);

	const flash = useCallback((text: string) => {
		setToast((t) => ({ text, n: (t?.n ?? 0) + 1 }));
		clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToast(null), 2400);
	}, []);

	useEffect(() => {
		listNotes()
			.then(async (list) => {
				setNotes(list);
				// A voice note that arrived while this window was opening.
				const id = await takeFocus().catch(() => null);
				if (id) open(id);
			})
			.catch(() => setNotes([]));
		getState().then(setAppState).catch(() => {});
		getAppInfo().then(setAppInfo).catch(() => {});
		const offs = [
			onNotes((list) => {
				setNotes(list);
				// The open note was deleted elsewhere (retention): go back.
				const v = viewRef.current;
				if (v.page === "note" && v.id && !list.some((n) => n.id === v.id)) show("list");
			}),
			onState(setAppState),
			onAppInfo(setAppInfo),
			onNote((n) => {
				if (n.id === viewRef.current.id) setNote(n);
			}),
			onFocus((id) => open(id)),
		];
		return () => offs.forEach((off) => off());
	}, [open, show]);

	// Esc closes the confirm, then goes back to the list.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			if (confirming) setConfirming(false);
			else if (viewRef.current.page !== "list") show("list");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [show, confirming]);

	const togglePin = async () => setAppState(await setPinned(!state.pinned));

	const render = (v: View) =>
		v.page === "settings" ? (
			<Settings notes={notes} onSaved={() => setSaved((s) => s + 1)} />
		) : v.page === "note" ? (
			note && note.id === v.id ? (
				<NoteView note={note} />
			) : (
				<div />
			)
		) : (
			<NoteList notes={notes} state={state} appInfo={appInfo} onOpen={open} />
		);

	const title =
		view.page === "settings"
			? "Settings"
			: view.page === "note" && note?.id === view.id
				? whenLabel(note.received)
				: "Voice notes";

	// The window dims while the open note is being transcribed.
	const immersive =
		view.page === "note" && note?.id === view.id && (note.status === "queued" || note.status === "processing");

	return (
		<div className={`app-root relative flex h-full flex-col overflow-clip ${immersive ? "immersive" : ""}`}>
			{/* Title bar: drag region, traffic lights sit in the left inset. */}
			<header className="electrobun-webkit-app-region-drag relative z-20 flex h-[52px] shrink-0 items-center justify-center px-3">
				{view.page !== "list" ? (
					<div key="back" className="electrobun-webkit-app-region-no-drag animate-swap absolute left-[78px]">
						<IconButton icon="back" label="All voice notes" onClick={() => show("list")} />
					</div>
				) : null}
				<h1 key={keyOf(view)} className="animate-swap text-[13px] font-semibold tracking-[-0.01em]">
					{title}
				</h1>
				<div className="electrobun-webkit-app-region-no-drag absolute right-3 flex items-center gap-0.5">
					{view.page === "settings" ? (
						saved ? (
							<span
								key={saved}
								className="animate-saved inline-flex items-center gap-1 pr-1.5 text-[12px] font-medium text-accent"
								aria-live="polite"
							>
								<Icon name="check" size={13} /> Saved
							</span>
						) : null
					) : (
						<>
							{view.page === "note" ? (
								<>
									{note && note.id === view.id && note.status === "done" ? (
										<IconButton icon="retry" label="Transcribe again" onClick={() => void transcribe(note.id)} />
									) : null}
									<IconButton icon="trash" label="Delete voice note" onClick={() => setConfirming(true)} />
								</>
							) : (
								<IconButton icon="sliders" label="Settings" onClick={() => show("settings")} />
							)}
							<IconButton
								icon="pin"
								label={state.pinned ? "Stop keeping on top" : "Keep on top"}
								active={state.pinned}
								onClick={() => void togglePin()}
							/>
						</>
					)}
				</div>
			</header>

			<main className="relative min-h-0 flex-1">
				{leaving && keyOf(leaving) !== keyOf(view) ? (
					<div
						key={`out-${keyOf(leaving)}`}
						aria-hidden
						className="animate-view-out pointer-events-none absolute inset-0"
						style={{ ["--dir" as string]: leaving.dir }}
					>
						{render(leaving)}
					</div>
				) : null}
				<div
					key={keyOf(view)}
					className={`h-full ${view.n > 0 ? "animate-view-in" : ""}`}
					style={{ ["--dir" as string]: view.dir }}
				>
					{render(view)}
				</div>

				{confirming && view.page === "note" && view.id ? (
					<ConfirmDelete
						onCancel={() => setConfirming(false)}
						onDelete={async () => {
							const id = view.id!;
							await deleteNote(id);
							setConfirming(false);
							show("list");
							flash("Voice note deleted. The audio is in the Trash.");
						}}
					/>
				) : null}
			</main>

			{toast ? (
				<div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
					<div
						key={toast.n}
						role="status"
						className="animate-toast flex items-center gap-2 rounded-[8px] bg-ink px-3 py-2 text-[12.5px] font-medium text-bg"
					>
						<Icon name="check" size={14} />
						{toast.text}
					</div>
				</div>
			) : null}
		</div>
	);
}

function ConfirmDelete({ onCancel, onDelete }: { onCancel: () => void; onDelete: () => Promise<void> }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);
	return (
		<div className="absolute inset-0 z-30 flex flex-col justify-end">
			<button aria-label="Cancel" onClick={onCancel} className="animate-fade absolute inset-0 bg-bg/60 backdrop-blur-[2px]" />
			<div role="dialog" aria-label="Delete voice note" className="panel animate-sheet relative m-3 p-4">
				<p className="text-[13.5px] font-semibold">Delete this voice note?</p>
				<p className="mt-1 text-[12.5px] leading-[1.5]">
					The audio file goes to the Trash. The transcript, summary and chat are deleted.
				</p>
				{error ? <p className="mt-2 text-[12.5px] text-danger">Couldn't delete it. Try again.</p> : null}
				<div className="mt-3.5 flex justify-end gap-2">
					<Button onClick={onCancel}>Cancel</Button>
					<Button
						tone="danger"
						icon="trash"
						busy={busy}
						onClick={async () => {
							setBusy(true);
							setError(false);
							await onDelete().catch(() => {
								setBusy(false);
								setError(true);
							});
						}}
					>
						Delete
					</Button>
				</div>
			</div>
		</div>
	);
}
