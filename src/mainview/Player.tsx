import { useEffect, useRef, useState } from "react";
import { clock } from "./format";
import { getAudio } from "./rpc";
import { Icon, Spinner } from "./ui";

// Deterministic bar heights per note so each one has its own shape.
function shape(id: string, count: number) {
	let h = 2166136261;
	for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return Array.from({ length: count }, (_, i) => {
		h = Math.imul(h ^ (i + 1), 2246822507) >>> 0;
		const r = (h % 1000) / 1000;
		const envelope = Math.sin((Math.PI * (i + 0.5)) / count) * 0.6 + 0.4;
		return Math.round(4 + r * 18 * envelope);
	});
}

export function Player({ id, duration }: { id: string; duration: number | null }) {
	const audio = useRef<HTMLAudioElement | null>(null);
	const [loading, setLoading] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [time, setTime] = useState(0);
	const [total, setTotal] = useState(duration ?? 0);
	const [failed, setFailed] = useState(false);
	const bars = useRef(shape(id, 34)).current;

	useEffect(
		() => () => {
			audio.current?.pause();
			audio.current = null;
		},
		[],
	);

	async function ensure() {
		if (audio.current) return audio.current;
		setLoading(true);
		try {
			const src = await getAudio(id);
			if (!src) throw new Error("missing");
			const a = new Audio(src);
			a.ontimeupdate = () => setTime(a.currentTime);
			// WebKit's estimate for Ogg files can be a second long, so the
			// afinfo duration wins when there is one.
			a.onloadedmetadata = () => !duration && Number.isFinite(a.duration) && setTotal(a.duration);
			a.onplay = () => setPlaying(true);
			a.onpause = () => setPlaying(false);
			a.onended = () => {
				setPlaying(false);
				setTime(0);
			};
			audio.current = a;
			return a;
		} catch {
			setFailed(true);
			return null;
		} finally {
			setLoading(false);
		}
	}

	async function toggle() {
		const a = await ensure();
		if (!a) return;
		if (a.paused) void a.play();
		else a.pause();
	}

	async function seek(e: React.MouseEvent<HTMLDivElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		const a = await ensure();
		if (!a || !total) return;
		a.currentTime = ratio * total;
		setTime(a.currentTime);
		if (a.paused) void a.play();
	}

	const progress = total ? time / total : 0;
	return (
		<div className="panel flex items-center gap-3 px-3 py-2.5">
			<button
				onClick={() => void toggle()}
				disabled={failed}
				aria-label={playing ? "Pause" : "Play"}
				className="press grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-accent text-accent-ink hover:brightness-105 disabled:opacity-40"
			>
				{loading ? <Spinner /> : <Icon name={playing ? "pause" : "play"} size={16} />}
			</button>
			<div
				role="slider"
				aria-label="Seek"
				aria-valuemin={0}
				aria-valuemax={Math.round(total)}
				aria-valuenow={Math.round(time)}
				tabIndex={0}
				onClick={(e) => void seek(e)}
				className="flex h-[30px] min-w-0 flex-1 cursor-pointer items-center justify-between"
			>
				{bars.map((h, i) => (
					<span
						key={i}
						className={`w-[3px] rounded-full transition-colors duration-200 ${
							i / bars.length < progress ? "bg-accent" : "bg-ink/20"
						}`}
						style={{ height: h }}
					/>
				))}
			</div>
			<span className="tabular w-[34px] shrink-0 text-right font-mono text-[11.5px] text-ink-3">
				{failed ? "–" : clock(playing || time ? time : total)}
			</span>
		</div>
	);
}
