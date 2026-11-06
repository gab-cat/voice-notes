import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Effort, NoteSummary, PatternTest, Preferences, SettingsInfo } from "../shared/types";
import { chooseFolder, getSettings, setPreferences, showAudioFolder, testPattern } from "./rpc";
import { Button, Icon, Segmented, Spinner, Switch } from "./ui";

const EFFORT_LABEL: Record<Effort, string> = { low: "Low", medium: "Medium", high: "High" };
const DAY = 86_400_000;

const folderName = (dir: string) => dir.split("/").filter(Boolean).pop() ?? dir;

export function Settings({ notes, onSaved }: { notes: NoteSummary[] | null; onSaved: () => void }) {
	const [info, setInfo] = useState<SettingsInfo | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		getSettings()
			.then(setInfo)
			.catch(() => setError("Couldn't load settings."));
	}, []);

	async function save(p: Partial<Preferences>) {
		// Optimistic: the control moves now, the app confirms after.
		setInfo((cur) => (cur ? { ...cur, prefs: { ...cur.prefs, ...p } } : cur));
		try {
			setInfo(await setPreferences(p));
			setError(null);
			onSaved();
		} catch (err) {
			setError((err as Error).message || "Couldn't save that setting.");
			getSettings().then(setInfo).catch(() => {});
		}
	}

	if (!info) {
		return (
			<div className="scroll-soft h-full overflow-y-auto px-4 pb-6 pt-1">
				{error ? <p className="panel p-3.5 text-[12.5px]">{error}</p> : <SettingsSkeleton />}
			</div>
		);
	}

	const { prefs, models } = info;
	const model = models.find((m) => m.id === prefs.model) ?? models[0];
	const efforts = model?.efforts ?? ["low", "medium", "high"];

	return (
		<div className="scroll-soft h-full overflow-y-auto px-4 pb-6 pt-1">
			{error ? (
				<p role="alert" className="animate-rise mb-3 rounded-[8px] bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
					{error}
				</p>
			) : null}

			<Section i={0} title="Picking up voice notes">
				<Row label="Watch folder">
					<span className="truncate text-[12.5px]" title={prefs.watchDir}>
						{folderName(prefs.watchDir)}
					</span>
					<Button
						onClick={async () => {
							const dir = await chooseFolder(prefs.watchDir).catch(() => null);
							if (dir && dir !== prefs.watchDir) await save({ watchDir: dir });
						}}
					>
						Change
					</Button>
				</Row>
				<PatternField info={info} onSave={(pattern) => save({ pattern })} />
			</Section>

			<Section i={1} title="Transcription">
				<Row label="Model">
					<label className="relative">
						<span className="sr-only">Model</span>
						<select
							value={model?.id ?? prefs.model}
							onChange={(e) => {
								const next = models.find((m) => m.id === e.target.value);
								if (!next) return;
								const effort = next.efforts.includes(prefs.effort)
									? prefs.effort
									: (next.efforts[Math.floor(next.efforts.length / 2)] ?? prefs.effort);
								void save({ model: next.id, effort });
							}}
							className="press h-[30px] max-w-[190px] cursor-pointer appearance-none truncate rounded-[7px] bg-ink/[0.06] pl-3 pr-8 text-[12.5px] font-medium text-ink hover:bg-ink/[0.1] dark:bg-ink/[0.08]"
						>
							{models.map((m) => (
								<option key={m.id} value={m.id}>
									{m.label}
								</option>
							))}
						</select>
						<Icon name="chevron" size={14} className="pointer-events-none absolute right-2.5 top-[8px] text-ink-2" />
					</label>
				</Row>
				<Row label="Reasoning">
					<Segmented
						size="sm"
						label="Reasoning level"
						value={prefs.effort}
						onChange={(effort) => void save({ effort })}
						options={(["low", "medium", "high"] as Effort[]).map((e) => ({
							value: e,
							label: EFFORT_LABEL[e],
							disabled: !efforts.includes(e),
						}))}
					/>
				</Row>
				<Row label="Timed transcript">
					<Switch label="Timed transcript" checked={prefs.timed} onChange={(timed) => void save({ timed })} />
				</Row>
			</Section>
			<div className="animate-rise -mt-3 mb-5 space-y-1.5 px-0.5 text-[12px] leading-[1.5]" style={{ ["--i" as string]: 1 }}>
				<p>Low reasoning is the fastest and is enough for most voice notes. Medium and high take two to three times longer.</p>
				<p>
					A timed transcript gives each line the time it was said, like subtitles. Tap a line to play from there,
					or copy it as an SRT file.
				</p>
				<p>Changes apply to the next voice note. Reasoning also applies to chat replies.</p>
			</div>

			<Retention info={info} notes={notes} onSave={(retentionDays) => save({ retentionDays })} />
		</div>
	);
}

function Section({ title, children, i }: { title: string; children: ReactNode; i: number }) {
	return (
		<section className="animate-rise mb-5" style={{ ["--i" as string]: i }}>
			<h2 className="mb-1.5 px-0.5 text-[13px] font-semibold">{title}</h2>
			<div className="panel divide-y divide-line/70">{children}</div>
		</section>
	);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex min-h-[48px] items-center justify-between gap-3 px-3.5 py-2">
			<span className="shrink-0 text-[13px]">{label}</span>
			<div className="flex min-w-0 items-center gap-2">{children}</div>
		</div>
	);
}

function PatternField({ info, onSave }: { info: SettingsInfo; onSave: (pattern: string) => Promise<void> }) {
	const saved = info.prefs.pattern;
	const [draft, setDraft] = useState(saved);
	const [test, setTest] = useState<PatternTest | null>(null);
	const [saving, setSaving] = useState(false);
	const dirty = draft !== saved;
	const seq = useRef(0);

	useEffect(() => setDraft(saved), [saved]);

	// Live check against the watched folder as you type.
	useEffect(() => {
		const n = ++seq.current;
		const t = setTimeout(async () => {
			const r = await testPattern(draft, info.prefs.watchDir).catch(() => null);
			if (n === seq.current) setTest(r);
		}, 180);
		return () => clearTimeout(t);
	}, [draft, info.prefs.watchDir]);

	const folder = folderName(info.prefs.watchDir);
	const commit = async () => {
		if (!dirty || test?.error) return;
		setSaving(true);
		await onSave(draft).finally(() => setSaving(false));
	};

	return (
		<div className="px-3.5 py-3">
			<label htmlFor="pattern" className="text-[13px]">
				File names to watch for
			</label>
			<input
				id="pattern"
				value={draft}
				spellCheck={false}
				autoCapitalize="off"
				autoCorrect="off"
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") void commit();
					if (e.key === "Escape" && dirty) {
						e.stopPropagation();
						setDraft(saved);
					}
				}}
				aria-invalid={!!test?.error}
				className={`selectable mt-2 h-[32px] w-full rounded-[7px] bg-ink/[0.05] px-2.5 font-mono text-[12px] text-ink ring-1 transition-shadow duration-200 focus:ring-2 dark:bg-ink/[0.07] ${
					test?.error ? "ring-danger/70 focus:ring-danger" : "ring-line focus:ring-accent/70"
				}`}
			/>

			<div className="mt-2 min-h-[18px] text-[12px] leading-[1.5]" aria-live="polite">
				{test === null ? (
					<span className="inline-flex items-center gap-1.5">
						<Spinner size={11} /> Checking {folder}
					</span>
				) : test.error ? (
					<span className="text-danger">Not a valid pattern: {test.error}</span>
				) : test.total === 0 ? (
					<span>No audio files in {folder} match right now.</span>
				) : (
					<div key={test.total} className="animate-swap">
						<span>
							{test.total} audio file{test.total === 1 ? "" : "s"} in {folder} match
							{dirty ? ". Saving moves them into Voice Notes." : "."}
						</span>
						<ul className="mt-1 space-y-0.5">
							{test.matches.map((m) => (
								<li key={m} className="truncate font-mono text-[11px]" title={m}>
									{m}
								</li>
							))}
							{test.total > test.matches.length ? (
								<li className="text-[11px]">and {test.total - test.matches.length} more</li>
							) : null}
						</ul>
					</div>
				)}
			</div>

			{dirty ? (
				<div className="animate-rise mt-2.5 flex gap-2">
					<Button tone="accent" busy={saving} disabled={!!test?.error} onClick={() => void commit()}>
						Save pattern
					</Button>
					<Button onClick={() => setDraft(saved)}>Cancel</Button>
				</div>
			) : saved !== info.defaults.pattern ? (
				<button
					onClick={() => setDraft(info.defaults.pattern)}
					className="press mt-1.5 rounded-[6px] px-1 py-0.5 text-[12px] font-medium text-accent hover:bg-accent/10"
				>
					Use the WhatsApp pattern
				</button>
			) : null}
		</div>
	);
}

function Retention({
	info,
	notes,
	onSave,
}: {
	info: SettingsInfo;
	notes: NoteSummary[] | null;
	onSave: (days: number) => Promise<void>;
}) {
	const days = info.prefs.retentionDays;
	const on = days > 0;
	const last = useRef(on ? days : info.defaults.retentionDays || 7);
	if (on) last.current = days;

	const now = Date.now();
	const expiring = on
		? (notes ?? []).filter(
				(n) => n.status !== "queued" && n.status !== "processing" && now - Date.parse(n.addedAt) > days * DAY,
			).length
		: 0;

	const step = (d: number) => void onSave(Math.max(1, Math.min(365, days + d)));

	return (
		<>
			<Section i={2} title="Keeping voice notes">
				<Row label="Delete old voice notes">
					<Switch label="Delete old voice notes" checked={on} onChange={(v) => void onSave(v ? last.current : 0)} />
				</Row>
				<div
					className={`grid !border-t-0 transition-[grid-template-rows,opacity] duration-300 ease-out ${
						on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
					}`}
				>
					<div className="overflow-hidden border-t border-line/70">
						<Row label="After">
							<div className="flex items-center gap-1">
								<StepButton icon="minus" label="One day fewer" disabled={days <= 1} onClick={() => step(-1)} />
								<span key={days} className="animate-swap tabular w-[62px] text-center text-[13px] font-medium">
									{days} day{days === 1 ? "" : "s"}
								</span>
								<StepButton icon="plus" label="One day more" disabled={days >= 365} onClick={() => step(1)} />
							</div>
						</Row>
					</div>
				</div>
				<Row label="Voice notes folder">
					<Button icon="folder" onClick={() => void showAudioFolder()}>
						Show in Finder
					</Button>
				</Row>
			</Section>
			<div className="animate-rise -mt-3 px-0.5 text-[12px] leading-[1.5]" style={{ ["--i" as string]: 2 }}>
				{on ? (
					<p>
						A voice note is deleted {days} day{days === 1 ? "" : "s"} after it arrives, with its transcript and
						chat. The audio goes to the Trash.
					</p>
				) : (
					<p>Voice notes stay until you delete them.</p>
				)}
				{expiring ? (
					<p key={expiring} className="animate-swap mt-1.5 font-medium text-danger">
						{expiring} voice note{expiring === 1 ? " is" : "s are"} older than this and will be deleted in a few
						seconds.
					</p>
				) : null}
			</div>
		</>
	);
}

function StepButton({
	icon,
	label,
	onClick,
	disabled,
}: {
	icon: "minus" | "plus";
	label: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
			className="press grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-ink/[0.06] text-ink hover:bg-ink/[0.1] disabled:opacity-35 dark:bg-ink/[0.08]"
		>
			<Icon name={icon} size={14} />
		</button>
	);
}

/** Mirrors the three sections: their headings are static, the rows load. */
function SettingsSkeleton() {
	const rows = [2, 3, 3];
	const titles = ["Picking up voice notes", "Transcription", "Keeping voice notes"];
	return (
		<>
			{rows.map((count, s) => (
				<section key={s} className="mb-5">
					<h2 className="mb-1.5 px-0.5 text-[13px] font-semibold">{titles[s]}</h2>
					<div className="panel divide-y divide-line/70">
						{Array.from({ length: count }, (_, i) => (
							<div key={i} className="flex min-h-[48px] items-center justify-between px-3.5">
								<div className="skeleton h-[13px] w-[90px]" />
								<div className="skeleton h-[30px] w-[96px] rounded-[7px]" />
							</div>
						))}
					</div>
				</section>
			))}
		</>
	);
}
