// Hero: a field of waveform bars running to the horizon. Quiet swells roll
// toward you; when the voice note plays (window.vnLevel), rings of sound move
// out from the middle, and the cursor leaves ripples where it passes.
import * as THREE from "three";

const host = document.getElementById("hero-canvas");
const hero = document.getElementById("hero");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function css(name) {
	const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(Number);
	return new THREE.Color(v[0] / 255, v[1] / 255, v[2] / 255);
}

function start() {
	let renderer;
	try {
		renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
	} catch {
		document.documentElement.classList.add("no-3d");
		return;
	}
	renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
	host.append(renderer.domElement);

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);

	const COLS = 104;
	const ROWS = 46;
	const SX = 0.4;
	const SZ = 0.52;
	const Z_NEAR = 7;
	const count = COLS * ROWS;

	const geo = new THREE.BoxGeometry(0.09, 1, 0.09);
	geo.translate(0, 0.5, 0);
	const mat = new THREE.MeshBasicMaterial();
	const mesh = new THREE.InstancedMesh(geo, mat, count);
	mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	scene.add(mesh);

	const xs = new Float32Array(count);
	const zs = new Float32Array(count);
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const i = r * COLS + c;
			xs[i] = (c - (COLS - 1) / 2) * SX;
			zs[i] = Z_NEAR - r * SZ;
		}
	}

	let bg, base, accent, hot;
	const palette = () => {
		bg = css("--bg");
		const ink = css("--ink");
		accent = css("--accent");
		const dark = bg.r < 0.5;
		base = bg.clone().lerp(ink, dark ? 0.2 : 0.16);
		hot = accent.clone().lerp(new THREE.Color(1, 1, 1), dark ? 0.25 : 0);
		renderer.setClearColor(bg);
		scene.fog = new THREE.Fog(bg, 9, 31);
	};
	palette();
	addEventListener("vn-theme", () => requestAnimationFrame(palette));
	matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => requestAnimationFrame(palette));

	const resize = () => {
		const w = host.clientWidth;
		const h = host.clientHeight;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		// Narrow screens: step back so the field still fills the width.
		const back = w < 700 ? 4 : 0;
		camera.position.set(0, 3.1 + back * 0.3, 13.5 + back);
		// Look a little above the floor so the horizon sits under the buttons.
		camera.lookAt(0, 2.3, -6);
		camera.updateProjectionMatrix();
	};
	resize();
	new ResizeObserver(resize).observe(host);

	// Cursor ripples on the floor.
	const ray = new THREE.Raycaster();
	const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	const hit = new THREE.Vector3();
	const ripples = []; // { x, z, t0 }
	let lastRipple = 0;
	hero.addEventListener("pointermove", (e) => {
		const r = renderer.domElement.getBoundingClientRect();
		const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
		const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
		ray.setFromCamera({ x: nx, y: ny }, camera);
		if (!ray.ray.intersectPlane(floor, hit)) return;
		const now = performance.now() / 1000;
		if (now - lastRipple < 0.12) return;
		lastRipple = now;
		ripples.push({ x: hit.x, z: hit.z, t0: now });
		if (ripples.length > 10) ripples.shift();
	});

	const m = new THREE.Matrix4();
	const col = new THREE.Color();
	let level = 0;
	let raf = 0;
	let first = true;

	const frame = (ms) => {
		const t = ms / 1000;
		level += ((window.vnLevel || 0) - level) * 0.12;

		for (let i = 0; i < count; i++) {
			const x = xs[i];
			const z = zs[i];
			// Calm swells rolling toward the camera.
			let h =
				0.12 +
				0.22 * (0.5 + 0.5 * Math.sin(x * 0.33 + t * 0.5)) * (0.5 + 0.5 * Math.cos(z * 0.42 - t * 0.9)) +
				0.08 * Math.sin(x * 1.3 - z * 0.7 + t * 0.7);

			// Sound: rings travelling out from the middle of the field.
			if (level > 0.01) {
				const dz = z + 6;
				const d = Math.sqrt(x * x + dz * dz);
				const ring = 0.5 + 0.5 * Math.sin(d * 1.6 - t * 7.5);
				const fall = Math.exp(-d * 0.09);
				const spine = Math.exp(-(x * x) / 18);
				h += level * (1.7 * ring * fall + 0.7 * spine * (0.5 + 0.5 * Math.sin(z * 1.1 + t * 11)));
			}

			// Cursor ripples, fading over 2.4s.
			for (const rp of ripples) {
				const age = t - rp.t0;
				if (age > 2.4) continue;
				const d = Math.hypot(x - rp.x, z - rp.z);
				const front = Math.exp(-((d - age * 5) ** 2) / 0.9);
				h += front * 0.9 * (1 - age / 2.4);
			}

			m.makeScale(1, Math.max(0.04, h), 1);
			m.setPosition(x, 0, z);
			mesh.setMatrixAt(i, m);

			const k = Math.min(1, Math.max(0, (h - 0.15) / 1.6));
			col.copy(base).lerp(accent, Math.min(1, k * 1.6));
			if (k > 0.7) col.lerp(hot, (k - 0.7) / 0.3);
			mesh.setColorAt(i, col);
		}
		while (ripples.length && t - ripples[0].t0 > 2.4) ripples.shift();
		mesh.instanceMatrix.needsUpdate = true;
		mesh.instanceColor.needsUpdate = true;
		renderer.render(scene, camera);
		if (first) {
			first = false;
			host.classList.add("ready");
		}
	};

	const loop = (ms) => {
		raf = requestAnimationFrame(loop);
		frame(ms);
	};

	if (reduced) {
		// One still frame; redraw while the voice note plays so it still responds.
		frame(0);
		const still = () => {
			if ((window.vnLevel || 0) > 0) frame(performance.now());
			requestAnimationFrame(still);
		};
		requestAnimationFrame(still);
		return;
	}

	new IntersectionObserver(([e]) => {
		cancelAnimationFrame(raf);
		if (e.isIntersecting) raf = requestAnimationFrame(loop);
	}).observe(host);
}

try {
	start();
} catch (err) {
	console.error(err);
	document.documentElement.classList.add("no-3d");
}
