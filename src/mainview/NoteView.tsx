import { useEffect, useState } from "react";
import type { Note } from "../shared/types";
import { Chat } from "./Chat";
import { dirOf, paragraphs } from "./format";
import { SignInCard } from "./NoteList";
import { Player } from "./Player";
import { setItem, transcribe } from "./rpc";
import { Bars, Button, CopyButton, Icon, Segmented } from "./ui";

type Tab = "summary" | "transcript" | "chat";

export function NoteView({ note }: { note: Note }) {
	const [tab, setTab] = useState<Tab>("summary");
	const done = note.status === "done";
	useEffect(() => setTab("summary"), [note.id]);

	return (
		<div className="flex h-full flex-col">
			<div className="shrink-0 space-y-3 px-4 pt-1">
				<Player id={note.id} duration={note.duration} />
				{done ? (
					<div className="flex items-center justify-between">
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
						{tab === "summary" ? <Summary note={note} /> : <Transcript note={note} />}
					</div>
				)}
			</div>
		</div>
	);
}

function Summary({ note }: { note: Note }) {
	return (
		<div className="space-y-5">
			<p className="selectable text-[14px] leading-[1.55]">{note.summary}</p>

			{note.actionItems.length ? (
				<section className="animate-rise" style={{ ["--i" as string]: 1 }}>
					<div className="mb-1.5 flex items-center justify-between">
						<h2 className="text-[13px] font-semibold">To do</h2>
						<CopyButton text={note.actionItems.map((i) => `- ${i.text}`).join("\n")} />
					</div>
					<ul className="panel divide-y divide-line/70 overflow-hidden">
						{note.actionItems.map((item, i) => (
							<li key={i}>
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
				<section className="animate-rise" style={{ ["--i" as string]: 2 }}>
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

function Transcript({ note }: { note: Note }) {
	const [lang, setLang] = useState<"original" | "english">("original");
	const text = lang === "english" && note.english ? note.english : note.transcript;
	return (
		<div>
			<div className="mb-3 flex items-center justify-between">
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
				<CopyButton text={text} />
			</div>
			<div key={lang} className="animate-swap selectable space-y-3 text-[14px] leading-[1.65]">
				{paragraphs(text).map((p, i) => (
					<p key={i} dir={dirOf(p)}>
						{p}
					</p>
				))}
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

	if (note.status === "queued" || note.status === "processing") {
		// Skeleton mirrors the Summary tab: paragraph, then the to-do list.
		return (
			<div className="px-4 pt-4">
				<div className="mb-4 flex items-center gap-2.5 text-[12.5px]">
					<Bars heights={[6, 11, 15, 9, 13]} active className="text-accent" />
					{note.status === "queued" ? "Waiting for Antigravity" : "Antigravity is listening"}
				</div>
				<div className="space-y-2">
					<div className="skeleton h-[14px] w-full" />
					<div className="skeleton h-[14px] w-[92%]" />
					<div className="skeleton h-[14px] w-[64%]" />
				</div>
				<h2 className="mb-1.5 mt-5 text-[13px] font-semibold">To do</h2>
				<div className="panel divide-y divide-line/70 overflow-hidden">
					{[70, 52, 60].map((w) => (
						<div key={w} className="flex items-center gap-2.5 px-3 py-3">
							<div className="skeleton h-[16px] w-[16px]" />
							<div className="skeleton h-[13px]" style={{ width: `${w}%` }} />
						</div>
					))}
				</div>
			</div>
		);
	}

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
