import { useCallback, useEffect, useRef, useState } from "react";
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

export type Playback = {
	id: string;
	time: number;
	total: number;
	playing: boolean;
	loading: boolean;
	failed: boolean;
	/** True once playback has started and not run to the end. */
	started: boolean;
	rate: number;
	toggle: () => Promise<void>;
	seekTo: (seconds: number) => Promise<void>;
	nextRate: () => void;
};

const RATES = [1, 1.5, 2];
const RATE_KEY = "voice-notes:rate";

// The speed you picked carries over to the next voice note.
function savedRate() {
	try {
		const r = Number(localStorage.getItem(RATE_KEY));
		return RATES.includes(r) ? r : 1;
	} catch {
		return 1;
	}
}

/** One audio element per open note, shared by the player and the transcript. */
export function usePlayback(id: string, duration: number | null): Playback {
	const audio = useRef<HTMLAudioElement | null>(null);
	const [loading, setLoading] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [time, setTime] = useState(0);
	const [total, setTotal] = useState(duration ?? 0);
	const [failed, setFailed] = useState(false);
	const [rate, setRate] = useState(savedRate);
	const rateRef = useRef(rate);
	rateRef.current = rate;

	useEffect(() => {
		if (duration) setTotal(duration);
	}, [duration]);

	useEffect(() => {
		const a = audio.current;
		if (!a) return;
		a.defaultPlaybackRate = rate;
		a.playbackRate = rate;
	}, [rate]);

	useEffect(
		() => () => {
			audio.current?.pause();
			audio.current = null;
		},
		[],
	);

	// timeupdate fires about 4 times a second; follow the audio every frame
	// while it plays so the transcript highlight moves with the voice.
	useEffect(() => {
		if (!playing) return;
		let raf = 0;
		const tick = () => {
			if (audio.current) setTime(audio.current.currentTime);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [playing]);

	const ensure = useCallback(async () => {
		if (audio.current) return audio.current;
		setLoading(true);
		try {
			const src = await getAudio(id);
			if (!src) throw new Error("missing");
			const a = new Audio(src);
			// Faster, but voices keep their natural pitch.
			a.preservesPitch = true;
			a.defaultPlaybackRate = rateRef.current;
			a.playbackRate = rateRef.current;
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
	}, [id, duration]);

	const toggle = useCallback(async () => {
		const a = await ensure();
		if (!a) return;
		if (a.paused) void a.play();
		else a.pause();
	}, [ensure]);

	const seekTo = useCallback(
		async (seconds: number) => {
			const a = await ensure();
			if (!a) return;
			// A hair past the start, so the line you tapped is the one that lights up.
			a.currentTime = Math.max(0, seconds + 0.01);
			setTime(a.currentTime);
			if (a.paused) void a.play();
		},
		[ensure],
	);

	const nextRate = useCallback(() => {
		setRate((r) => {
			const next = RATES[(RATES.indexOf(r) + 1) % RATES.length];
			try {
				localStorage.setItem(RATE_KEY, String(next));
			} catch {}
			return next;
		});
	}, []);

	return {
		id,
		time,
		total,
		playing,
		loading,
		failed,
		started: playing || time > 0,
		rate,
		toggle,
		seekTo,
		nextRate,
	};
}

export function Player({ playback }: { playback: Playback }) {
	const { id, time, total, playing, loading, failed, rate, toggle, seekTo, nextRate } = playback;
	const bars = useRef(shape(id, 34)).current;

	function seek(e: React.MouseEvent<HTMLDivElement>) {
		if (!total) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		void seekTo(ratio * total);
	}

	function key(e: React.KeyboardEvent<HTMLDivElement>) {
		if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
			e.preventDefault();
			void seekTo(Math.min(total, Math.max(0, time + (e.key === "ArrowRight" ? 5 : -5))));
		} else if (e.key === " " || e.key === "Enter") {
			e.preventDefault();
			void toggle();
		}
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
				onClick={seek}
				onKeyDown={key}
				className="flex h-[30px] min-w-0 flex-1 cursor-pointer items-center justify-between rounded-[4px] focus-visible:ring-2 focus-visible:ring-accent/70"
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
			<button
				onClick={nextRate}
				disabled={failed}
				aria-label={`Playback speed ${rate} times. Change speed`}
				title="Playback speed"
				className={`press tabular grid h-[26px] w-[38px] shrink-0 place-items-center overflow-hidden rounded-[6px] font-mono text-[11.5px] font-semibold disabled:opacity-40 ${
					rate === 1
						? "bg-ink/[0.06] text-ink hover:bg-ink/[0.1] active:bg-ink/[0.13]"
						: "bg-accent/15 text-accent hover:bg-accent/20 active:bg-accent/25"
				}`}
			>
				<span key={rate} className="animate-rate">
					{rate}×
				</span>
			</button>
		</div>
	);
}
