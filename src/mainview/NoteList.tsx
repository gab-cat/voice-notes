import { useState } from "react";
import type { AppState, NoteSummary } from "../shared/types";
import { clock, dayLabel, timeLabel } from "./format";
import { openSignIn, retryAuthFailed } from "./rpc";
import { Bars, Button } from "./ui";

const STATUS: Record<NoteSummary["status"], string> = {
	new: "Not transcribed",
	queued: "Waiting",
	processing: "Transcribing",
	done: "",
	error: "Couldn't transcribe",
};

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

export function NoteList({
	notes,
	state,
	onOpen,
}: {
	notes: NoteSummary[] | null;
	state: AppState;
	onOpen: (id: string) => void;
}) {
	return (
		<div className="scroll-soft h-full overflow-y-auto pb-4 pt-1">
			{state.downloadsBlocked ? (
				<div className="panel mx-4 mb-3 p-3.5 text-[12.5px] leading-[1.5]">
					macOS is blocking access to Downloads. Allow it in System Settings, Privacy & Security, Files and
					Folders.
				</div>
			) : null}
			{state.signedIn === false ? <SignInCard /> : null}

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
				<ul className="panel mx-4 divide-y divide-line/70 overflow-hidden">
					{notes.map((n, i) => (
						<li key={n.id} className="animate-rise" style={{ ["--i" as string]: Math.min(i, 10) }}>
							<button
								onClick={() => onOpen(n.id)}
								className="press-soft block w-full px-3.5 py-3 text-left hover:bg-ink/[0.035] active:bg-ink/[0.06]"
							>
								<div className="flex items-baseline justify-between gap-3">
									<span className="text-[13px] font-medium">
										{dayLabel(n.received)}, {timeLabel(n.received)}
									</span>
									<span className="tabular font-mono text-[11.5px] text-ink-3">{clock(n.duration)}</span>
								</div>
								{n.status === "done" ? (
									<p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.45] text-ink">{n.summary}</p>
								) : (
									<p className="mt-1 flex items-center gap-2 text-[12.5px] text-ink">
										<span
											className={`h-1.5 w-1.5 rounded-full ${
												n.status === "processing" || n.status === "queued"
													? "animate-pulse-dot bg-accent"
													: n.status === "error"
														? "bg-danger"
														: "bg-ink/25"
											}`}
										/>
										{n.status === "error" && n.errorKind === "auth" ? "Needs sign-in" : STATUS[n.status]}
									</p>
								)}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function Empty() {
	return (
		<div className="flex h-full flex-col items-center justify-center px-10 pb-16 text-center">
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
