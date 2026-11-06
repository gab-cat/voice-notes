// Full-window scene while a voice note is transcribed.
//
// The window goes dark. A dark orb sits inside a thin ring of light, with the
// note's own waveform around it and a live sound wave running through it. Fine grains spiral into it on a tilted disc,
// passing behind and in front, and now and then a character drifts out and
// settles: the voice turning into text. When the result arrives everything
// is drawn into the orb, it collapses to a point of light, and the point
// blooms as the light comes back up.

import { useEffect, useRef, useState } from "react";
import type { Note } from "../shared/types";

// Deterministic per note, so each voice note has its own ring.
function shape(id: string, count: number) {
	let h = 2166136261;
	for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return Array.from({ length: count }, (_, i) => {
		h = Math.imul(h ^ (i + 1), 2246822507) >>> 0;
		const r = (h % 1000) / 1000;
		const envelope = Math.sin((Math.PI * (i + 0.5)) / count) * 0.5 + 0.5;
		return 0.15 + r * 0.85 * envelope;
	});
}

const GLYPHS = [
	..."abcdefghijklmnopqrstuvwxyz",
	..."ابتجدرسعفقلمنهوي",
	..."αβγδλμπσω",
	..."бгджзклмнпрст",
	..."कगजतदनपमरस",
	..."あいうえおかきくけこ",
];
const pick = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutBack = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeIn = (x: number) => x ** 3;

// Grains keep where they started (r0) and a small head start (d), so the
// collapse pulls them in one after another, not all at once.
type Grain = { phi: number; rho: number; r0: number; d: number; spin: number; size: number; age: number; w: number };
type Glyph = { a: number; r: number; vr: number; ch: string; swap: number; size: number; age: number };

const TILT = 0.34; // the disc is seen from a little above
const BARS = 72;
const GRAINS = 110;
/** Seconds the ending takes, from the first pull to the light being back. */
export const IMPLODE_S = 1.05;

function useScene(id: string, active: boolean, leaving: boolean) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const slotRef = useRef<HTMLDivElement>(null);
	const activeRef = useRef(active);
	activeRef.current = active;

	useEffect(() => {
		const canvas = canvasRef.current;
		const slot = slotRef.current;
		if (!canvas || !slot) return;
		const ctx = canvas.getContext("2d")!;
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const peak = document.documentElement.classList.contains("dark") ? 0.35 : 0.92;
		const half = shape(id, BARS / 2);
		const env = shape(`${id}:env`, 64);

		let W = 0;
		let H = 0;
		let cx = 0;
		let cy = 0;
		let R = 60;
		let maxR = 300;
		const grains: Grain[] = [];
		const glyphs: Glyph[] = [];
		const ripples: number[] = [];
		let level = 0.4;
		let energy = activeRef.current ? 1 : 0.3;
		let lastRipple = 0;
		let spawnDebt = 0;

		const newGrain = (anywhere: boolean): Grain => {
			const rho = anywhere ? R * 1.3 + Math.random() * (maxR - R * 1.3) : maxR * (0.8 + Math.random() * 0.2);
			return {
				phi: Math.random() * Math.PI * 2,
				rho,
				r0: rho,
				d: Math.random() * 0.22,
				spin: 0.7 + Math.random() * 0.6,
				size: Math.random() < 0.75 ? 0.8 : 1.3,
				age: anywhere ? 1 : 0,
				w: 0,
			};
		};

		const resize = () => {
			const c = canvas.getBoundingClientRect();
			const s = slot.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			W = c.width;
			H = c.height;
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			cx = s.left - c.left + s.width / 2;
			cy = s.top - c.top + s.height / 2;
			R = clamp(Math.min(s.width, s.height) * 0.21, 40, 80);
			maxR = Math.hypot(W, H) * 0.55;
			if (!grains.length) for (let i = 0; i < GRAINS; i++) grains.push(newGrain(true));
		};
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);
		ro.observe(slot);
		resize();

		const t0 = performance.now();
		let last = t0;
		let raf = 0;

		const frame = (now: number) => {
			// The first frame's timestamp can be a little before t0.
			const dt = clamp((now - last) / 1000, 0, 0.05);
			last = Math.max(last, now);
			const t = Math.max(0, (now - t0) / 1000);
			const intro = leaving || still ? 1 : easeOutBack(clamp(t / 1.2));
			const fadeIn = leaving || still ? 1 : clamp(t / 1.6);
			// The ending: a breath in, then everything is pulled into the orb until
			// it is a point of light (pull), and the point blooms (bloom).
			const end = leaving ? clamp(t / IMPLODE_S) : 0;
			const pull = leaving ? clamp(end / 0.5) : 0;
			const bloom = leaving ? clamp((end - 0.5) / 0.5) : 0;
			const shrink = !leaving
				? 1
				: pull < 0.16
					? 1 + 0.08 * easeOut(pull / 0.16)
					: 1.08 * (1 - easeIn((pull - 0.16) / 0.84));
			energy += ((activeRef.current ? 1 : 0.3) - energy) * Math.min(1, dt * 2.5);

			// A speech-like envelope: syllables from the note's shape.
			const syll = env[Math.floor(t * 7) % env.length];
			const target = still ? 0.5 : syll ** 1.3 * (0.7 + 0.3 * Math.abs(Math.sin(t * 8.3) * Math.sin(t * 3.1)));
			level += (target * energy - level) * Math.min(1, dt * 7);

			ctx.clearRect(0, 0, W, H);
			ctx.globalCompositeOperation = "lighter";
			ctx.lineCap = "round";

			const Rc = R * 0.8 * intro * (1 + 0.04 * level) * shrink;
			const hasOrb = Rc > 0.6;

			// ── Ripples: plain circles, every couple of seconds ────────────
			if (!still && !leaving && energy > 0.6 && now - lastRipple > 2300) {
				ripples.push(now);
				lastRipple = now;
			}
			for (let i = ripples.length - 1; i >= 0; i--) {
				const p = (now - ripples[i]) / 3200;
				if (p >= 1) {
					ripples.splice(i, 1);
					continue;
				}
				ctx.strokeStyle = `hsla(268,80%,82%,${0.16 * (1 - p) ** 2 * fadeIn})`;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.arc(cx, cy, Rc + easeOut(p) * maxR, 0, Math.PI * 2);
				ctx.stroke();
			}
			// Rings of light close in from the edges, faster as they near the orb.
			if (leaving && pull < 1) {
				for (let k = 0; k < 2; k++) {
					const p = clamp(pull * 1.3 - k * 0.3);
					if (p <= 0 || p >= 1) continue;
					ctx.strokeStyle = `hsla(272,90%,86%,${0.4 * Math.sin(p * Math.PI)})`;
					ctx.lineWidth = 1.2;
					ctx.beginPath();
					ctx.arc(cx, cy, Math.max(0.5, Rc) + maxR * 1.1 * (1 - easeIn(p)), 0, Math.PI * 2);
					ctx.stroke();
				}
			}

			// ── Disc of grains, spiralling in ──────────────────────────────
			for (const g of grains) {
				const near = Math.min((R * 2) / g.rho, 10);
				if (leaving) {
					// Drawn in, spinning faster the closer each grain gets.
					const local = clamp((pull - g.d) / (1 - g.d));
					g.rho = Math.max(0.5, g.r0 * (1 - local ** 2));
					g.w = g.spin * (0.4 + 1.6 * near ** 1.2);
					if (!still) g.phi += g.w * dt;
					continue;
				}
				g.w = g.spin * (0.22 + 1.4 * near ** 1.3) * (0.35 + 0.65 * energy);
				if (still) continue;
				g.age += dt;
				g.phi += g.w * dt;
				g.rho -= (7 + 40 * near) * (0.3 + 0.7 * energy) * dt;
				g.r0 = g.rho;
				if (g.rho < R * 0.86) Object.assign(g, newGrain(false));
			}
			// Grouped into a few paths by brightness, so a frame is a handful of strokes.
			const drawGrains = (front: boolean) => {
				const groups = new Map<number, Path2D>();
				for (const g of grains) {
					const s = Math.sin(g.phi);
					if (s >= 0 !== front) continue;
					const depth = 0.35 + 0.65 * (s * 0.5 + 0.5);
					const near = clamp((g.rho - Math.max(Rc, 1) * 0.86) / (R * 0.4));
					const far = clamp((maxR - g.rho) / (maxR * 0.3));
					const a =
						clamp(g.age) * near * far * depth * (0.3 + 0.7 * energy) * fadeIn * (1 + pull * 0.6) * (1 - bloom);
					if (a < 0.03) continue;
					const key = Math.min(4, Math.round(a * 4)) * 2 + (g.size > 1 ? 1 : 0);
					let path = groups.get(key);
					if (!path) groups.set(key, (path = new Path2D()));
					const from = g.phi - clamp(g.w * 0.12, 0.015, 0.6);
					path.moveTo(cx + Math.cos(from) * g.rho, cy + Math.sin(from) * g.rho * TILT);
					path.ellipse(cx, cy, g.rho, g.rho * TILT, 0, from, g.phi);
				}
				for (const [key, path] of groups) {
					ctx.strokeStyle = `hsla(266,70%,86%,${(Math.floor(key / 2) / 4) * (leaving ? 0.85 : 0.55)})`;
					ctx.lineWidth = key % 2 ? 1.3 : 0.8;
					ctx.stroke(path);
				}
			};
			drawGrains(false);

			// ── Orb ───────────────────────────────────────────────────────
			if (hasOrb) {
				const halo = ctx.createRadialGradient(cx, cy, Rc * 0.9, cx, cy, Rc * 2.8);
				halo.addColorStop(0, `hsla(266,90%,64%,${(0.26 + 0.18 * level) * (1 + pull) * fadeIn})`);
				halo.addColorStop(1, "hsla(266,90%,60%,0)");
				ctx.fillStyle = halo;
				ctx.fillRect(cx - Rc * 2.8, cy - Rc * 2.8, Rc * 5.6, Rc * 5.6);
			}

			// The waveform as a thin ring, mirrored so it reads as one shape.
			const rot = still ? 0 : t * 0.08;
			const bars = new Path2D();
			for (let i = 0; i < BARS; i++) {
				const j = i < BARS / 2 ? i : BARS - 1 - i;
				const th = (i / BARS) * Math.PI * 2 - Math.PI / 2 + rot;
				const live = still ? 1 : 0.75 + 0.25 * Math.sin(t * 6 + j * 0.8);
				const v = half[j] * (0.3 + 0.85 * level) * live;
				const len = (2 + v * R * 0.55) * intro * (0.35 + 0.65 * energy) * (1 - pull);
				const r0 = Math.max(0, Rc) + 8 * (1 - pull);
				bars.moveTo(cx + Math.cos(th) * r0, cy + Math.sin(th) * r0);
				bars.lineTo(cx + Math.cos(th) * (r0 + len), cy + Math.sin(th) * (r0 + len));
			}
			ctx.lineWidth = 4;
			ctx.strokeStyle = `hsla(266,100%,70%,${0.08 * fadeIn})`;
			ctx.stroke(bars);
			ctx.lineWidth = 1.4;
			ctx.strokeStyle = `hsla(270,100%,88%,${0.85 * fadeIn})`;
			ctx.stroke(bars);

			// Core: opaque, so it hides the grains behind it.
			ctx.globalCompositeOperation = "source-over";
			if (hasOrb) {
				const core = ctx.createRadialGradient(cx, cy - Rc * 0.1, 0, cx, cy, Rc);
				core.addColorStop(0, "hsl(258,55%,5%)");
				core.addColorStop(0.8, "hsl(258,60%,8%)");
				core.addColorStop(1, "hsl(266,80%,20%)");
				ctx.globalAlpha = fadeIn;
				ctx.fillStyle = core;
				ctx.beginPath();
				ctx.arc(cx, cy, Rc, 0, Math.PI * 2);
				ctx.fill();
				ctx.globalAlpha = 1;

				// A sound wave runs through the dark, rising and falling with the
				// voice: one bright line and two fainter echoes behind it. The ends
				// taper to the centre line so it sits inside the orb.
				ctx.save();
				ctx.beginPath();
				ctx.arc(cx, cy, Rc * 0.94, 0, Math.PI * 2);
				ctx.clip();
				ctx.globalCompositeOperation = "lighter";
				const span = Rc * 0.8;
				const amp = Rc * 0.44 * (0.3 + 0.7 * level) * (0.35 + 0.65 * energy) * fadeIn;
				const tw = still ? 0.8 : t;
				// Echoes first (pink, then blue), the bright line on top.
				const lines = [
					{ hue: 300, alpha: 0.5, width: 1.1, scale: 0.78, speed: 3.1, offset: 2.3 },
					{ hue: 228, alpha: 0.55, width: 1.1, scale: 0.62, speed: 1.9, offset: 4.1 },
					{ hue: 280, alpha: 0.95, width: 1.8, scale: 1, speed: 2.5, offset: 0 },
				];
				for (const [k, line] of lines.entries()) {
					const wave = new Path2D();
					const ph = tw * line.speed + line.offset;
					for (let i = 0; i <= 64; i++) {
						const u = i / 64;
						const taper = Math.sin(Math.PI * u) ** 2;
						const y =
							Math.sin(u * 14 + ph) * 0.55 +
							Math.sin(u * 23 - ph * 1.4) * 0.22 +
							Math.sin(u * 6 + ph * 0.7) * 0.38;
						const x = cx - span + u * span * 2;
						if (i) wave.lineTo(x, cy + amp * taper * y * line.scale);
						else wave.moveTo(x, cy);
					}
					if (k === lines.length - 1) {
						ctx.lineWidth = 6;
						ctx.strokeStyle = `hsla(272,100%,70%,${0.22 * fadeIn})`;
						ctx.stroke(wave);
					}
					ctx.lineWidth = line.width;
					ctx.strokeStyle = `hsla(${line.hue},100%,${k === lines.length - 1 ? 92 : 74}%,${line.alpha * fadeIn})`;
					ctx.stroke(wave);
				}
				ctx.restore();
			}

			// The ring of light, brighter on the side turning toward you, and
			// brighter still as it is squeezed.
			if (hasOrb) {
				ctx.globalCompositeOperation = "lighter";
				const spin = still ? 0.6 : t * 1.2;
				const conic =
					typeof ctx.createConicGradient === "function" ? ctx.createConicGradient(spin, cx, cy) : null;
				if (conic) {
					conic.addColorStop(0, "hsla(280,100%,96%,1)");
					conic.addColorStop(0.5, "hsla(258,90%,62%,0.35)");
					conic.addColorStop(1, "hsla(280,100%,96%,1)");
				}
				for (const [w, alpha] of [
					[6 * (1 + pull), 0.14 * (1 + pull)],
					[1.4 * (1 + pull * 0.8), 1],
				] as const) {
					ctx.globalAlpha = alpha * fadeIn;
					ctx.strokeStyle = conic ?? "hsla(275,100%,88%,1)";
					ctx.lineWidth = w;
					ctx.beginPath();
					ctx.arc(cx, cy, Rc, 0, Math.PI * 2);
					ctx.stroke();
				}
				ctx.globalAlpha = 1;
			}

			ctx.globalCompositeOperation = "lighter";
			drawGrains(true);

			// ── A few characters drift out and settle ─────────────────────
			if (!still && activeRef.current && !leaving) {
				spawnDebt += dt * (1.5 + 4 * level) * fadeIn;
				while (spawnDebt >= 1) {
					spawnDebt -= 1;
					glyphs.push({
						a: Math.random() * Math.PI * 2,
						r: Rc + 14,
						vr: 18 + Math.random() * 26,
						ch: pick(),
						swap: 0,
						size: 10 + Math.random() * 3,
						age: 0,
					});
				}
			}
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			for (let i = glyphs.length - 1; i >= 0; i--) {
				const g = glyphs[i];
				g.age += dt;
				g.r += g.vr * dt;
				const travel = (g.r - Rc) / (maxR * 0.55);
				if (travel > 1) {
					glyphs.splice(i, 1);
					continue;
				}
				const settled = travel > 0.18;
				if (!settled && (g.swap -= dt) <= 0) {
					g.ch = pick();
					g.swap = 0.06 + Math.random() * 0.08;
				}
				const a = clamp(g.age / 0.4) * (1 - travel) ** 1.6 * fadeIn * 0.6;
				ctx.font = `400 ${g.size}px "Geist Mono Variable", ui-monospace, monospace`;
				ctx.fillStyle = settled ? `hsla(270,60%,94%,${a})` : `hsla(268,100%,78%,${a})`;
				ctx.fillText(g.ch, cx + Math.cos(g.a) * g.r, cy + Math.sin(g.a) * g.r * 0.92);
			}

			// ── The point of light, then the bloom that brings the light back ─
			if (leaving) {
				const star = clamp((pull - 0.7) / 0.3) * (1 - clamp(bloom / 0.5));
				if (star > 0.01) {
					const r = 4 + 24 * star + 40 * bloom;
					const point = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
					point.addColorStop(0, `hsla(285,100%,99%,${star})`);
					point.addColorStop(0.25, `hsla(275,100%,88%,${0.7 * star})`);
					point.addColorStop(1, "hsla(270,100%,70%,0)");
					ctx.fillStyle = point;
					ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
				}
				// It washes the whole window for a moment, so the dark lifts out of
				// sight. Softer when the result underneath is dark too.
				if (bloom > 0) {
					// Grows out of the point with no hard edge.
					const grow = easeOut(clamp(bloom / 0.28));
					const a = peak * (bloom < 0.28 ? grow : 1 - easeIn(clamp((bloom - 0.55) / 0.45)));
					const r = Math.max(W, H) * 1.6 * grow;
					const light = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
					light.addColorStop(0, `hsla(280,100%,97%,${a})`);
					light.addColorStop(0.45, `hsla(270,90%,92%,${a * 0.85})`);
					light.addColorStop(1, "hsla(265,80%,88%,0)");
					ctx.fillStyle = light;
					ctx.fillRect(0, 0, W, H);
				}
			}
			ctx.globalCompositeOperation = "source-over";

			if (!still) raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	}, [id, leaving]);

	return { canvasRef, slotRef };
}

// ── A word that types itself out of scrambled letters ──────────────────────

const NOISE = "abcdefghijklmnopqrstuvwxyz";

function Decode({ text, className = "" }: { text: string; className?: string }) {
	const [shown, setShown] = useState(0);
	const [noise, setNoise] = useState("");

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setShown(text.length);
			return;
		}
		let n = 0;
		const timer = setInterval(() => {
			n += 1;
			const done = Math.max(0, n - 3);
			let s = "";
			for (let i = done; i < Math.min(text.length, n); i++)
				s += text[i] === " " ? " " : NOISE[(Math.random() * NOISE.length) | 0];
			setShown(Math.min(text.length, done));
			setNoise(s);
			if (done >= text.length) clearInterval(timer);
		}, 45);
		return () => clearInterval(timer);
	}, [text]);

	return (
		<p className={className} aria-label={text}>
			<span aria-hidden>{text.slice(0, shown)}</span>
			<span aria-hidden className="opacity-50">
				{noise}
			</span>
			{/* Holds the final width, so the word doesn't shift while it types. */}
			<span aria-hidden className="opacity-0">
				{text.slice(shown + noise.length)}
			</span>
		</p>
	);
}

export function Listening({ note, leaving }: { note: Note; leaving?: boolean }) {
	const active = note.status === "processing" || !!leaving;
	const { canvasRef, slotRef } = useScene(note.id, active, !!leaving);

	return (
		// Reaches up behind the transparent title bar, so the whole window is the scene.
		<div
			className={`scene absolute inset-x-0 bottom-0 top-[-52px] overflow-hidden ${
				leaving ? "scene-leaving" : "animate-scene-in"
			}`}
		>
			<div aria-hidden className={`scene-glow ${active ? "" : "scene-glow-dim"}`} />
			<canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />

			<div
				className={`relative flex h-full flex-col items-center justify-center pb-8 pt-[52px] text-center ${
					leaving ? "opacity-0 transition-opacity duration-200" : ""
				}`}
			>
				<div ref={slotRef} className="h-[300px] w-full" />
				<Decode
					key={active ? "on" : "off"}
					text={active ? "Listening" : "Waiting its turn"}
					className="scene-label mt-2 text-[15px] font-medium tracking-[-0.01em] text-ink"
				/>
			</div>
		</div>
	);
}
