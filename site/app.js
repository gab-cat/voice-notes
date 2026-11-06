/* Voice Notes site. Plain JS, no build step.
   The window replica mirrors src/mainview (App, NoteList, NoteView, Chat). */
(() => {
	"use strict";

	const $ = (s, el = document) => el.querySelector(s);
	const $$ = (s, el = document) => [...el.querySelectorAll(s)];
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const REPO = "gab-cat/voice-notes";
	const DMG_URL = `https://github.com/${REPO}/releases/latest/download/stable-macos-arm64-VoiceNotes.dmg`;
	const esc = (s) =>
		String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

	// Shared with hero.js: how loud the voice note is right now (0..1).
	window.vnLevel = 0;

	// ── Icons (20px grid, 1.6 stroke, the app's set) ──────────────────────────

	const ICONS = {
		play: '<svg viewBox="0 0 20 20"><path d="M7.5 5.2v9.6l7.6-4.8z" fill="currentColor"/></svg>',
		pause:
			'<svg viewBox="0 0 20 20" fill="currentColor"><rect x="6" y="5" width="2.8" height="10" rx="1"/><rect x="11.2" y="5" width="2.8" height="10" rx="1"/></svg>',
		back: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5L6.5 10l5.5 5.5"/></svg>',
		pin: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 3.5h5l-.8 4.6 2.8 2.9H5.5l2.8-2.9z"/><path d="M10 11v5.5"/></svg>',
		copy: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="9" height="9" rx="2"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/></svg>',
		check: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10.5l3 3 7-7"/></svg>',
		send: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15.5v-11M5.5 9L10 4.5 14.5 9"/></svg>',
		github:
			'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
		apple:
			'<svg viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>',
	};

	function paintIcons(root = document) {
		for (const el of $$("[data-icon]", root)) {
			if (el.firstChild) continue;
			el.innerHTML = ICONS[el.dataset.icon] || "";
		}
	}

	const icon = (name) => `<span data-icon="${name}">${ICONS[name]}</span>`;

	// Deterministic bar heights, the same idea as the app's Player.
	function shape(seed, count, min = 4, max = 22) {
		let h = 2166136261;
		for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
		return Array.from({ length: count }, (_, i) => {
			h = Math.imul(h ^ (i + 1), 2246822507) >>> 0;
			const r = (h % 1000) / 1000;
			const env = Math.sin((Math.PI * (i + 0.5)) / count) * 0.6 + 0.4;
			return Math.round(min + r * (max - min) * env);
		});
	}

	const clock = (s) => {
		const t = Math.max(0, Math.round(s));
		return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
	};

	// Right-to-left only when RTL letters outnumber Latin ones (format.ts dirOf).
	function dirOf(text) {
		const rtl = (text.match(/[֐-ࣿיִ-﷿ﹰ-﻿]/g) || []).length;
		const ltr = (text.match(/[A-Za-zÀ-ɏ]/g) || []).length;
		return rtl > ltr ? "rtl" : "ltr";
	}

	const paragraphs = (t) =>
		t
			.split(/\n{2,}/)
			.map((p) => p.trim())
			.filter(Boolean);

	async function copyText(text) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			return false;
		}
	}

	// ── Segmented controls ────────────────────────────────────────────────────

	function layoutSeg(seg, animate = true) {
		const thumb = $(".seg-thumb", seg);
		const on = $('button[aria-checked="true"]', seg);
		if (!thumb || !on) return;
		if (!animate) thumb.style.transition = "none";
		thumb.style.width = `${on.offsetWidth}px`;
		thumb.style.transform = `translateX(${on.offsetLeft - 3}px)`;
		thumb.style.left = "3px";
		if (!animate) requestAnimationFrame(() => (thumb.style.transition = ""));
	}

	function segValue(seg, attr, value) {
		for (const b of $$("button", seg)) b.setAttribute("aria-checked", String(b.dataset[attr] === value));
		layoutSeg(seg);
	}

	// ── Sample voice notes (made up) ──────────────────────────────────────────

	const SAMPLES = [
		{
			id: "bakery",
			file: "WhatsApp Audio 2026-11-07 at 09.41.12.opus",
			when: "Today, 9:41 AM",
			duration: 38,
			language: "English",
			summary:
				"They want the hero photo swapped for the croissant shot and the opening hours moved higher, because customers keep calling about them. They also want a quote for online orders by Friday.",
			actionItems: [
				"Swap the hero photo for the croissant shot",
				"Move the opening hours higher on the page",
				"Send a quote for online orders by Friday",
			],
			questions: ["What would it cost to add online orders?"],
			transcript:
				"Hi! Quick one about the bakery site. Can we swap the big photo at the top for the croissant shot? People love that one.\n\nAlso, move the opening hours higher up, everyone keeps calling to ask. And what would it cost to add online orders? If you can send me a quote by Friday, that'd be great.",
			english: "",
			replies: {
				"Draft a reply":
					"Hi! Sure, I'll swap in the croissant shot and move the opening hours up today. For online orders, I'll put a quote together and send it before Friday.",
				"Reply in English":
					"It's already in English, so here's a shorter one: Will do both today. Quote for online orders coming before Friday.",
				"What's urgent?":
					"The quote. They want it by Friday. The photo swap and the opening hours are quick fixes you can do today.",
				"Make a task list":
					"1. Swap the hero photo for the croissant shot\n2. Move the opening hours higher on the page\n3. Price online ordering and send the quote by Friday",
			},
		},
		{
			id: "pricing",
			file: "WhatsApp Audio 2026-11-07 at 10.05.47.opus",
			when: "Today, 10:05 AM",
			duration: 52,
			language: "Tagalog and English",
			summary:
				"They want the pricing section moved above the testimonials so people see prices first. The Dubai client needs the Arabic landing page by Thursday, and they're waiting for a staging link.",
			actionItems: [
				"Move pricing above the testimonials",
				"Finish the Arabic landing page by Thursday",
				"Send the staging link",
			],
			questions: ["Can we move the pricing section above the testimonials?"],
			transcript:
				"Hi! Pwede ba nating ilipat yung pricing section sa taas ng testimonials? Mas gusto ko kasi na makita agad ng tao yung presyo.\n\nTapos yung client natin sa Dubai, gusto nila yung Arabic version ng landing page by Thursday. Send mo sakin yung staging link pag ready na, salamat!",
			english:
				"Hi! Can we move the pricing section above the testimonials? I'd rather people see the prices right away.\n\nAlso, our client in Dubai wants the Arabic version of the landing page by Thursday. Send me the staging link when it's ready, thanks!",
			replies: {
				"Draft a reply":
					"Sige! Ililipat ko na yung pricing sa taas ng testimonials ngayon. Yung Arabic version, on track for Thursday. Send ko agad yung staging link pag live na.",
				"Reply in English":
					"Sure! I'll move pricing above the testimonials today. The Arabic version is on track for Thursday, and I'll send the staging link as soon as it's live.",
				"What's urgent?": "The Arabic landing page, due Thursday. Moving the pricing section is a quick change.",
				"Make a task list":
					"1. Move pricing above the testimonials\n2. Build the Arabic landing page, due Thursday\n3. Send the staging link",
			},
		},
		{
			id: "menu",
			file: "WhatsApp Audio 2026-11-07 at 11.20.03.opus",
			when: "Today, 11:20 AM",
			duration: 31,
			language: "Arabic and English",
			summary:
				"They're checking on the menu photos and want the dessert photos added before Saturday. They also want the invoice sent by email, not WhatsApp.",
			actionItems: ["Add the dessert photos before Saturday", "Email the invoice"],
			questions: ["Can we add the dessert photos before Saturday?"],
			transcript:
				"مرحبا! Just checking on the menu photos.\n\nهل يمكن أن نضيف صور الحلويات قبل يوم السبت؟\n\nAnd please send the invoice to my email, not WhatsApp. شكرا!",
			english:
				"Hi! Just checking on the menu photos.\n\nCan we add the dessert photos before Saturday?\n\nAnd please send the invoice to my email, not WhatsApp. Thanks!",
			replies: {
				"Draft a reply":
					"مرحبا! Yes, the dessert photos will be up before Saturday. I'll email you the invoice today. شكرا!",
				"Reply in English":
					"Hi! Yes, the dessert photos will be up before Saturday, and I'll email you the invoice today. Thanks!",
				"What's urgent?": "The dessert photos, due before Saturday. The invoice just needs to go by email.",
				"Make a task list": "1. Add the dessert photos before Saturday\n2. Email the invoice",
			},
		},
	];

	const OLDER = {
		id: "logo",
		when: "Yesterday, 4:12 PM",
		duration: 23,
		language: "English",
		summary:
			"They're happy with the new logo and want it on the invoice template too. They asked when the business cards will be ready.",
		actionItems: ["Add the new logo to the invoice template", "Give a date for the business cards"],
		questions: ["When will the business cards be ready?"],
		transcript:
			"Hey, just listened back to everything. Love the new logo, honestly. Can you put it on the invoice template as well? And when do you think the business cards will be ready?",
		english: "",
		replies: {
			"Draft a reply":
				"Thank you! I'll add the logo to the invoice template today. The business cards should be ready early next week, I'll confirm the exact day tomorrow.",
			"Reply in English": "It's already in English. Shorter: Thanks! Logo goes on the invoice today, cards early next week.",
			"What's urgent?": "Nothing has a deadline. Giving them a date for the business cards is the open question.",
			"Make a task list": "1. Add the new logo to the invoice template\n2. Confirm a date for the business cards",
		},
	};

	const SHORTCUTS = ["Draft a reply", "Reply in English", "What's urgent?", "Make a task list"];

	function noteAsText(n, withTranscript) {
		const parts = [`Voice note, Nov 7, 2026 (${clock(n.duration)})`, `Summary\n${n.summary}`];
		if (n.actionItems.length)
			parts.push(`To do\n${n.actionItems.map((t, i) => `- [${n.done?.[i] ? "x" : " "}] ${t}`).join("\n")}`);
		if (n.questions.length) parts.push(`They asked\n${n.questions.map((q) => `- ${q}`).join("\n")}`);
		if (withTranscript) {
			parts.push(`Transcript\n${n.transcript}`);
			if (n.english) parts.push(`English translation\n${n.english}`);
		}
		return parts.join("\n\n");
	}

	// ── Hero: a voice note you can play ───────────────────────────────────────

	const HERO_TEXT =
		"Hi! Quick one about the bakery site. Can we swap the photo at the top for the croissant shot, and send me a quote for online orders by Friday?";
	const HERO_SECONDS = 14;

	const hero = {
		playing: false,
		t: 0,
		last: 0,
		bars: [],
		words: HERO_TEXT.split(" "),
		shown: 0,
	};

	function buildHero() {
		const wave = $("#hn-wave");
		const heights = shape("hero-note", 42, 5, 28);
		wave.innerHTML = heights.map((h) => `<i style="height:${h}px"></i>`).join("");
		hero.bars = $$("i", wave);
		$("#hn-play").addEventListener("click", () => toggleHero());
		$("#nav-status").addEventListener("click", () => {
			$("#hero").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
			toggleHero(true);
		});
		wave.addEventListener("click", (e) => {
			const r = wave.getBoundingClientRect();
			hero.t = Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width)) * HERO_SECONDS;
			hero.shown = Math.min(hero.shown, Math.floor((hero.t / HERO_SECONDS) * hero.words.length));
			renderWords(true);
			if (!hero.playing) toggleHero(true);
		});

		// No WebGL fallback bars.
		const fb = $(".hero-fallback");
		fb.innerHTML = shape("fallback", 48, 30, 190)
			.map((h, i) => `<i style="height:${h}px;--i:${i}"></i>`)
			.join("");
	}

	function toggleHero(force) {
		const play = force ?? !hero.playing;
		if (play === hero.playing) return;
		hero.playing = play;
		$("#hero-note").classList.toggle("playing", play);
		$("#hn-play").setAttribute("aria-label", play ? "Pause the sample voice note" : "Play the sample voice note");
		$("#nav-status").classList.toggle("on", play);
		$("#ns-text").textContent = play ? "Transcribing" : hero.t > 0 ? "Play it again" : "Play a voice note";
		if (play) {
			if (hero.t >= HERO_SECONDS) {
				hero.t = 0;
				hero.shown = 0;
				renderWords(true);
			}
			hero.last = performance.now();
			requestAnimationFrame(tickHero);
		} else {
			window.vnLevel = 0;
		}
	}

	function tickHero(now) {
		if (!hero.playing) return;
		const dt = Math.min(0.1, (now - hero.last) / 1000);
		hero.last = now;
		hero.t += dt;
		const p = Math.min(1, hero.t / HERO_SECONDS);
		const lit = Math.floor(p * hero.bars.length);
		hero.bars.forEach((b, i) => b.classList.toggle("on", i < lit));
		$("#hn-time").textContent = clock(HERO_SECONDS - hero.t);

		// A speech-like envelope: syllables inside phrases, with short pauses.
		const t = hero.t;
		const phrase = 0.5 + 0.5 * Math.sin(t * 1.7 + 0.6);
		const syll = Math.abs(Math.sin(t * 9.1) * Math.sin(t * 3.3 + 1.2));
		window.vnLevel = Math.min(1, 0.25 + phrase * 0.35 + syll * 0.55);

		// Words land a beat behind the audio, like a live transcript.
		const target = Math.floor(Math.max(0, (hero.t - 0.6) / (HERO_SECONDS - 1)) * hero.words.length);
		if (target > hero.shown) {
			hero.shown = Math.min(hero.words.length, target);
			renderWords(false);
		}

		if (hero.t >= HERO_SECONDS) {
			hero.shown = hero.words.length;
			renderWords(false);
			toggleHero(false);
			$("#hn-time").textContent = clock(HERO_SECONDS);
			hero.bars.forEach((b) => b.classList.add("on"));
			setTimeout(() => !hero.playing && hero.bars.forEach((b) => b.classList.remove("on")), 1600);
			return;
		}
		requestAnimationFrame(tickHero);
	}

	function renderWords(reset) {
		const el = $("#hero-transcript");
		if (hero.shown === 0) {
			el.innerHTML = '<span class="ht-hint">Press play. It writes down what it hears.</span>';
			return;
		}
		const have = reset ? 0 : $$(".ht-word", el).length;
		if (reset || have === 0) el.innerHTML = "";
		for (let i = reset ? 0 : have; i < hero.shown; i++) {
			const w = document.createElement("span");
			w.className = "ht-word";
			w.textContent = hero.words[i];
			if (i > 0) el.append(" ");
			el.append(w);
		}
	}

	// ── The window replica ────────────────────────────────────────────────────

	const vn = {
		notes: [], // { ...sample, status, done: [], chat: [] }
		view: null, // note id or null for the list
		tab: "summary",
		txLang: "original",
		pinned: true,
		busy: false,
		playing: null,
	};

	function makeNote(sample, status) {
		return { ...sample, status, done: sample.actionItems.map(() => false), chat: [] };
	}

	function buildDemo() {
		vn.notes = [makeNote(OLDER, "done")];
		const dl = $("#downloads");
		dl.innerHTML = SAMPLES.map(
			(s) => `
			<div class="dl-row" data-id="${s.id}">
				<span class="dl-file">opus</span>
				<span class="dl-meta">
					<span class="dl-name">${esc(s.file)}</span>
					<span class="dl-sub">${esc(s.language)} · ${clock(s.duration)}</span>
				</span>
				<button class="dl-btn press" type="button">Download</button>
				<span class="dl-progress"></span>
			</div>`,
		).join("");
		for (const row of $$(".dl-row", dl)) {
			$(".dl-btn", row).addEventListener("click", () => download(row));
		}

		const win = $("#vn");
		win.innerHTML = `
			<div class="vn-head">
				<div class="vn-lights" aria-hidden="true"><i></i><i></i><i></i></div>
				<button class="vn-ib vn-back press" type="button" aria-label="All voice notes" hidden>${icon("back")}</button>
				<span class="vn-title" id="vn-title">Voice notes</span>
				<button class="vn-ib vn-pin press active" type="button" aria-label="Stop keeping on top" aria-pressed="true">${icon("pin")}</button>
			</div>
			<div class="vn-body" id="vn-body"></div>`;
		$(".vn-back", win).addEventListener("click", () => go(null));
		$(".vn-pin", win).addEventListener("click", () => setPinned(!vn.pinned));
		win.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && vn.view) go(null);
		});
		render(true);
		buildTray();
		fitDesk();
		new ResizeObserver(fitDesk).observe($("#desk-stage"));
		tickClock();
		setInterval(tickClock, 15_000);
	}

	function tickClock() {
		const d = new Date();
		$("#dm-clock").textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	}

	// The desk is a fixed-size scene, scaled to fit. On narrow screens it
	// shrinks to just around the window so the window stays readable.
	function fitDesk() {
		const stage = $("#desk-stage");
		const desk = $("#desk");
		const w = stage.clientWidth;
		const deskW = w < 520 ? 420 : 680;
		desk.style.width = `${deskW}px`;
		$("#vn").style.right = deskW === 420 ? "20px" : "24px";
		const scale = Math.min(1, w / deskW);
		desk.style.left = `${Math.max(0, (w - deskW * scale) / 2)}px`;
		stage.style.setProperty("--desk-scale", String(scale));
		stage.style.setProperty("--desk-h", "680px");
	}

	function setPinned(p) {
		vn.pinned = p;
		const b = $(".vn-pin");
		b.classList.toggle("active", p);
		b.setAttribute("aria-pressed", String(p));
		b.setAttribute("aria-label", p ? "Stop keeping on top" : "Keep on top");
		buildTray();
	}

	function current() {
		return vn.notes.find((n) => n.id === vn.view) || null;
	}

	function go(id) {
		if (vn.view === id) return;
		const body = $("#vn-body");
		const old = $(".vn-view:not(.out)", body);
		const dir = id ? 1 : -1;
		if (old) {
			old.classList.remove("in");
			old.classList.add("out");
			old.style.setProperty("--dir", dir);
			setTimeout(() => old.remove(), 260);
		}
		stopPlayer();
		vn.view = id;
		vn.tab = "summary";
		vn.txLang = "original";
		render(false, dir);
	}

	function render(initial = false, dir = 1) {
		const body = $("#vn-body");
		const n = current();
		$(".vn-back").hidden = !n;
		$("#vn-title").textContent = n ? n.when : "Voice notes";
		const view = document.createElement("div");
		view.className = `vn-view${initial ? "" : " in"}`;
		view.style.setProperty("--dir", dir);
		view.innerHTML = n ? noteHTML(n) : listHTML();
		body.querySelector(".vn-view:not(.out)")?.remove();
		body.append(view);
		paintIcons(view);
		wireView(view);
	}

	// Re-render only the part of the note view that changed.
	function refreshNote() {
		const view = $("#vn-body .vn-view:not(.out)");
		if (!view) return;
		const n = current();
		if (!n) {
			view.innerHTML = listHTML();
		} else {
			view.innerHTML = noteHTML(n);
		}
		paintIcons(view);
		wireView(view);
	}

	function listHTML() {
		const rows = vn.notes
			.map((n, i) => {
				const sub =
					n.status === "done"
						? `<span class="vn-row-sub">${esc(n.summary)}</span>`
						: `<span class="vn-status"><span class="vn-dot busy"></span>Transcribing</span>`;
				return `<button class="vn-row" data-open="${n.id}" style="--i:${i}">
					<span class="vn-row-top"><span>${esc(n.when)}</span><span class="vn-dur">${clock(n.duration)}</span></span>
					${sub}
				</button>`;
			})
			.join("");
		return `<div class="vn-scroll" style="display:flex;flex-direction:column">
			<div class="vn-panel">${rows}</div>
			<div class="vn-foot">Voice Notes <span data-version-plain>0.1.1</span> · Up to date</div>
		</div>`;
	}

	function playerHTML(n) {
		const heights = shape(n.id, 34);
		return `<div class="vn-panel vn-player">
			<button class="vn-play press" type="button" data-play aria-label="Play">${icon("play")}</button>
			<div class="vn-bars" data-seek>${heights.map((h) => `<i style="height:${h}px"></i>`).join("")}</div>
			<span class="vn-time" data-time>${clock(n.duration)}</span>
		</div>`;
	}

	function noteHTML(n) {
		if (n.status !== "done") {
			return `<div class="vn-top">${playerHTML(n)}</div>
			<div class="vn-scroll">
				<div class="vn-listening"><span class="vn-mini">${[0, 1, 2, 3, 4].map((i) => `<i style="--i:${i}"></i>`).join("")}</span>Antigravity is listening</div>
				<div class="sk" style="width:100%"></div><div class="sk" style="width:92%"></div><div class="sk" style="width:64%"></div>
				<div class="vn-h">To do</div>
				<div class="vn-panel">${[70, 52, 60]
					.map(
						(w) =>
							`<div class="vn-item"><span class="vn-box"></span><span class="sk" style="width:${w}%;margin:2px 0"></span></div>`,
					)
					.join("")}</div>
			</div>`;
		}
		const tabs = ["summary", "transcript", "chat"];
		const labels = { summary: "Summary", transcript: "Transcript", chat: "Chat" };
		return `<div class="vn-top">
				${playerHTML(n)}
				<div class="vn-tabs-row">
					<div class="seg" data-tabs role="radiogroup" aria-label="Sections">
						<span class="seg-thumb"></span>
						${tabs.map((t) => `<button role="radio" data-tab="${t}" aria-checked="${vn.tab === t}">${labels[t]}</button>`).join("")}
					</div>
					<span class="vn-lang">${esc(n.language)}</span>
				</div>
			</div>
			${vn.tab === "chat" ? chatHTML(n) : `<div class="vn-scroll vn-tab" style="padding-top:16px">${vn.tab === "summary" ? summaryHTML(n) : transcriptHTML(n)}</div>`}`;
	}

	function summaryHTML(n) {
		return `<div class="vn-copyrow">
				<button class="vn-copy" data-copy-note="0">${icon("copy")}<span>Copy summary</span></button>
				<button class="vn-copy" data-copy-note="1">${icon("copy")}<span>Copy with transcript</span></button>
			</div>
			<p class="vn-summary">${esc(n.summary)}</p>
			${
				n.actionItems.length
					? `<div class="vn-h">To do</div><div class="vn-panel">${n.actionItems
							.map(
								(t, i) =>
									`<button class="vn-item${n.done[i] ? " done" : ""}" data-item="${i}" role="checkbox" aria-checked="${n.done[i]}"><span class="vn-box">${icon("check")}</span><span class="vn-item-text">${esc(t)}</span></button>`,
							)
							.join("")}</div>`
					: ""
			}
			${
				n.questions.length
					? `<div class="vn-h">They asked</div><ul class="vn-asked">${n.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>`
					: ""
			}`;
	}

	function transcriptHTML(n) {
		const text = vn.txLang === "english" && n.english ? n.english : n.transcript;
		return `<div class="vn-tx-head">
				${
					n.english
						? `<div class="seg sm" data-txlang role="radiogroup" aria-label="Transcript language"><span class="seg-thumb"></span>
							<button role="radio" data-lang="original" aria-checked="${vn.txLang === "original"}">Original</button>
							<button role="radio" data-lang="english" aria-checked="${vn.txLang === "english"}">English</button></div>`
						: "<span></span>"
				}
				<button class="vn-copy" data-copy-tx>${icon("copy")}<span>Copy</span></button>
			</div>
			<div class="vn-tx">${paragraphs(text)
				.map((p) => `<p dir="${dirOf(p)}">${esc(p)}</p>`)
				.join("")}</div>`;
	}

	function chatHTML(n) {
		const msgs = n.chat
			.map((m) => (m.role === "me" ? `<div class="vn-me">${esc(m.text)}</div>` : `<div class="vn-reply" dir="auto">${esc(m.text)}</div>`))
			.join("");
		const typing = vn.busy ? `<div class="vn-typing" aria-label="Replying">${[0, 1, 2].map((i) => `<i style="--i:${i}"></i>`).join("")}</div>` : "";
		return `<div class="vn-chat">
			<div class="vn-msgs" data-msgs>
				${msgs || typing ? msgs + typing : `<p class="vn-hint">Ask anything about this voice note, or start with one of the options below.</p>`}
			</div>
			<div class="vn-composer">
				<div class="vn-chips">${SHORTCUTS.map((s) => `<button class="vn-chip press" data-chip="${esc(s)}" ${vn.busy ? "disabled" : ""}>${esc(s)}</button>`).join("")}</div>
				<form class="vn-input" data-form>
					<input class="vn-field" data-field placeholder="Message Antigravity" aria-label="Message" ${vn.busy ? "disabled" : ""} />
					<button class="vn-send press" type="submit" aria-label="Send" ${vn.busy ? "disabled" : ""}>${icon("send")}</button>
				</form>
			</div>
		</div>`;
	}

	function wireView(view) {
		for (const b of $$("[data-open]", view)) b.addEventListener("click", () => go(b.dataset.open));
		const tabs = $("[data-tabs]", view);
		if (tabs) {
			requestAnimationFrame(() => layoutSeg(tabs, false));
			for (const b of $$("button", tabs))
				b.addEventListener("click", () => {
					if (vn.tab === b.dataset.tab) return;
					vn.tab = b.dataset.tab;
					segValue(tabs, "tab", vn.tab);
					setTimeout(refreshNote, 140);
				});
		}
		const tx = $("[data-txlang]", view);
		if (tx) {
			requestAnimationFrame(() => layoutSeg(tx, false));
			for (const b of $$("button", tx))
				b.addEventListener("click", () => {
					vn.txLang = b.dataset.lang;
					segValue(tx, "lang", vn.txLang);
					setTimeout(refreshNote, 140);
				});
		}
		for (const b of $$("[data-item]", view))
			b.addEventListener("click", () => {
				const n = current();
				const i = Number(b.dataset.item);
				n.done[i] = !n.done[i];
				b.classList.toggle("done", n.done[i]);
				b.setAttribute("aria-checked", String(n.done[i]));
			});
		for (const b of $$("[data-copy-note], [data-copy-tx]", view))
			b.addEventListener("click", async () => {
				const n = current();
				const text =
					"copyTx" in b.dataset
						? vn.txLang === "english" && n.english
							? n.english
							: n.transcript
						: noteAsText(n, b.dataset.copyNote === "1");
				const label = $("span:last-child", b);
				const old = label.textContent;
				const ok = await copyText(text);
				b.classList.add("done");
				label.textContent = ok ? "Copied" : "Couldn't copy";
				setTimeout(() => {
					b.classList.remove("done");
					label.textContent = old;
				}, 1400);
			});
		const play = $("[data-play]", view);
		if (play) {
			play.addEventListener("click", () => togglePlayer(view));
			$("[data-seek]", view).addEventListener("click", (e) => {
				const r = e.currentTarget.getBoundingClientRect();
				startPlayer(view, ((e.clientX - r.left) / r.width) * current().duration);
			});
		}
		for (const c of $$("[data-chip]", view)) c.addEventListener("click", () => ask(c.dataset.chip));
		const form = $("[data-form]", view);
		if (form)
			form.addEventListener("submit", (e) => {
				e.preventDefault();
				const f = $("[data-field]", form);
				const v = f.value.trim();
				if (!v) return;
				f.value = "";
				ask(v);
			});
		const msgs = $("[data-msgs]", view);
		if (msgs) msgs.scrollTop = msgs.scrollHeight;
	}

	// The player runs 3× fast: there's no audio on this page.
	function togglePlayer(view) {
		if (vn.playing) stopPlayer();
		else startPlayer(view, 0);
	}

	function startPlayer(view, from) {
		stopPlayer();
		const n = current();
		const bars = $$("[data-seek] i", view);
		const time = $("[data-time]", view);
		const btn = $("[data-play]", view);
		btn.innerHTML = icon("pause");
		let t = from;
		let last = performance.now();
		const p = { stop: false, btn };
		vn.playing = p;
		const step = (now) => {
			if (p.stop) return;
			t += ((now - last) / 1000) * 3;
			last = now;
			const prog = Math.min(1, t / n.duration);
			bars.forEach((b, i) => b.classList.toggle("on", i / bars.length < prog));
			time.textContent = clock(t);
			if (prog >= 1) {
				stopPlayer();
				bars.forEach((b) => b.classList.remove("on"));
				time.textContent = clock(n.duration);
				return;
			}
			requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	function stopPlayer() {
		if (!vn.playing) return;
		vn.playing.stop = true;
		if (vn.playing.btn.isConnected) vn.playing.btn.innerHTML = icon("play");
		vn.playing = null;
	}

	async function ask(message) {
		const n = current();
		if (!n || vn.busy) return;
		n.chat.push({ role: "me", text: message });
		vn.busy = true;
		refreshNote();
		await sleep(reduced ? 200 : 1100);
		const reply =
			n.replies[message] ||
			"In the app, Antigravity answers this from the transcript. On this page, try one of the shortcuts above.";
		const msg = { role: "agent", text: "" };
		n.chat.push(msg);
		vn.busy = false;
		// Type it out.
		const view = $("#vn-body .vn-view:not(.out)");
		refreshNote();
		const el = $$(".vn-reply", view).pop();
		if (!el) return;
		for (let i = 1; i <= reply.length; i += reduced ? reply.length : 3) {
			msg.text = reply.slice(0, i);
			el.textContent = msg.text;
			const msgs = $("[data-msgs]", view);
			if (msgs) msgs.scrollTop = msgs.scrollHeight;
			await sleep(14);
		}
		msg.text = reply;
		el.textContent = reply;
	}

	async function download(row) {
		const sample = SAMPLES.find((s) => s.id === row.dataset.id);
		const btn = $(".dl-btn", row);
		btn.disabled = true;
		btn.textContent = "Downloading";
		row.classList.add("loading");
		await sleep(reduced ? 100 : 750);
		btn.textContent = "In Downloads";

		// The app spots it within two seconds and opens the window on it.
		const note = makeNote(sample, "processing");
		vn.notes.unshift(note);
		const win = $("#vn");
		win.classList.remove("bump");
		void win.offsetWidth;
		win.classList.add("bump");
		if (vn.view) {
			vn.view = null;
		}
		go(note.id);
		buildTray();

		await sleep(reduced ? 300 : 2800);
		note.status = "done";
		buildTray();
		if (vn.view === note.id) refreshNote();
		else if (!vn.view) refreshNote();
		showToast(note);
	}

	let toastTimer;
	function showToast(n) {
		const t = $("#desk-toast");
		$("#dt-body").textContent = n.summary;
		t.classList.add("show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => t.classList.remove("show"), 4200);
	}

	// ── Menu bar ──────────────────────────────────────────────────────────────

	let updateLabel = "Check for updates";

	function buildTray() {
		const menu = $("#tray-menu");
		const pending = vn.notes.filter((n) => n.status !== "done").length;
		menu.innerHTML = `
			${pending ? `<div class="tm-item dim">Transcribing ${pending} voice note${pending > 1 ? "s" : ""}</div><div class="tm-sep"></div>` : ""}
			<button class="tm-item" role="menuitem" data-tm="show"><span class="tm-check"></span>Show Voice Notes</button>
			<button class="tm-item" role="menuitemcheckbox" aria-checked="${vn.pinned}" data-tm="pin"><span class="tm-check">${vn.pinned ? "✓" : ""}</span>Keep on top</button>
			<div class="tm-sep"></div>
			<button class="tm-item" role="menuitem" data-tm="update"><span class="tm-check"></span>${updateLabel}</button>
			<div class="tm-sep"></div>
			<button class="tm-item" role="menuitem" data-tm="quit"><span class="tm-check"></span>Quit</button>`;
		for (const b of $$("[data-tm]", menu)) b.addEventListener("click", () => trayAction(b.dataset.tm));
	}

	function openTray(open) {
		const menu = $("#tray-menu");
		menu.classList.toggle("open", open);
		$("#dm-tray").setAttribute("aria-expanded", String(open));
	}

	async function trayAction(action) {
		const win = $("#vn");
		if (action === "pin") setPinned(!vn.pinned);
		openTray(false);
		if (action === "show") {
			win.style.display = "";
			win.classList.remove("bump");
			void win.offsetWidth;
			win.classList.add("bump");
		} else if (action === "update") {
			updateLabel = "Checking for updates…";
			buildTray();
			await sleep(1200);
			updateLabel = "Up to date";
			buildTray();
			await sleep(2400);
			updateLabel = "Check for updates";
			buildTray();
		} else if (action === "quit") {
			win.style.display = "none";
			await sleep(1400);
			win.style.display = "";
			win.style.animation = "none";
			void win.offsetWidth;
			win.style.animation = "";
		}
	}

	function wireTray() {
		$("#dm-tray").addEventListener("click", (e) => {
			e.stopPropagation();
			openTray(!$("#tray-menu").classList.contains("open"));
		});
		document.addEventListener("click", (e) => {
			if (!e.target.closest("#tray-menu")) openTray(false);
		});
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape") openTray(false);
		});
	}

	// ── Pipeline ──────────────────────────────────────────────────────────────

	function buildPipe() {
		const pipe = $("#pipe");
		const steps = $$(".pipe-step", pipe);
		const track = $(".pipe-track", pipe);
		let i = -1;
		let timer = null;
		const place = () => {
			const nums = steps.map((s) => $(".ps-num", s));
			const tr = track.getBoundingClientRect();
			const xs = nums.map((n) => {
				const r = n.getBoundingClientRect();
				return r.left + r.width / 2 - tr.left;
			});
			const x = i < 0 ? 0 : xs[i];
			$("#pipe-packet").style.left = `${x}px`;
			$("#pipe-fill").style.width = `${x}px`;
		};
		const step = () => {
			i = (i + 1) % (steps.length + 1);
			if (i === steps.length) {
				// Hold on the last step, then start over.
				i = -1;
				steps.forEach((s) => s.classList.remove("lit"));
			} else {
				steps.forEach((s, j) => s.classList.toggle("lit", j <= i));
			}
			place();
		};
		addEventListener("resize", place);
		new IntersectionObserver(([e]) => {
			clearInterval(timer);
			if (e.isIntersecting) {
				step();
				timer = setInterval(step, 1500);
			}
		}).observe(pipe);
	}

	// ── Bento loops ───────────────────────────────────────────────────────────

	function whenVisible(el, start) {
		let stop = null;
		new IntersectionObserver(([e]) => {
			if (e.isIntersecting && !stop) stop = start();
			else if (!e.isIntersecting && stop) {
				stop();
				stop = null;
			}
		}).observe(el);
	}

	function buildBento() {
		whenVisible($("#mini-todo"), () => {
			const rows = $$(".mt-row", $("#mini-todo"));
			let i = 0;
			const t = setInterval(() => {
				if (i < rows.length) rows[i++].classList.add("done");
				else {
					rows.forEach((r) => r.classList.remove("done"));
					i = 0;
				}
			}, 1100);
			return () => clearInterval(t);
		});

		whenVisible($("#mini-copy"), () => {
			const out = $("#mc-out");
			const btn = $(".mc-btn", $("#mini-copy"));
			const text = noteAsText({ ...SAMPLES[0], done: [true, false, false] }, true);
			let alive = true;
			(async () => {
				while (alive) {
					out.textContent = "";
					btn.classList.add("hit");
					$(".mc-label", btn).textContent = "Copied";
					await sleep(500);
					btn.classList.remove("hit");
					for (let i = 0; i <= text.length && alive; i += 6) {
						out.textContent = text.slice(0, i);
						out.scrollTop = out.scrollHeight;
						await sleep(16);
					}
					await sleep(2600);
					$(".mc-label", btn).textContent = "Copy with transcript";
					await sleep(900);
				}
			})();
			return () => (alive = false);
		});

		whenVisible($("#mini-chat"), () => {
			const el = $("#mch-reply");
			const reply = SAMPLES[1].replies["Draft a reply"];
			let alive = true;
			(async () => {
				while (alive) {
					el.textContent = "";
					await sleep(700);
					for (let i = 0; i <= reply.length && alive; i += 2) {
						el.textContent = reply.slice(0, i);
						await sleep(22);
					}
					await sleep(3200);
				}
			})();
			return () => (alive = false);
		});
	}

	// ── Languages ─────────────────────────────────────────────────────────────

	function buildLanguages() {
		const pick = $("#lang-pick");
		const viewSeg = $("#lang-view");
		const state = { lang: "tl", view: "original" };
		const data = { tl: SAMPLES[1], ar: SAMPLES[2] };
		const paint = () => {
			const s = data[state.lang];
			const text = state.view === "english" ? s.english : s.transcript;
			$("#lang-body").innerHTML = paragraphs(text)
				.map((p, i) => `<p dir="${dirOf(p)}" style="--i:${i}">${esc(p)}</p>`)
				.join("");
		};
		for (const b of $$("button", pick))
			b.addEventListener("click", () => {
				state.lang = b.dataset.lang;
				segValue(pick, "lang", state.lang);
				paint();
			});
		for (const b of $$("button", viewSeg))
			b.addEventListener("click", () => {
				state.view = b.dataset.view;
				segValue(viewSeg, "view", state.view);
				paint();
			});
		for (const b of $$("button", pick)) b.setAttribute("aria-checked", String(b.dataset.lang === state.lang));
		for (const b of $$("button", viewSeg)) b.setAttribute("aria-checked", String(b.dataset.view === state.view));
		paint();
		const lay = () => {
			layoutSeg(pick, false);
			layoutSeg(viewSeg, false);
		};
		document.fonts?.ready.then(lay);
		requestAnimationFrame(lay);
		addEventListener("resize", lay);
	}

	// ── Install snippets ──────────────────────────────────────────────────────

	function buildSnippets() {
		for (const b of $$("[data-copy]")) {
			b.addEventListener("click", async () => {
				await copyText(b.dataset.copy);
				b.classList.add("done");
				b.innerHTML = ICONS.check;
				setTimeout(() => {
					b.classList.remove("done");
					b.innerHTML = ICONS.copy;
				}, 1400);
			});
		}
	}

	// ── Final: a wave that leans toward the cursor ────────────────────────────

	function cssColor(name) {
		const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(Number);
		return v.length >= 3 ? v : [172, 150, 255];
	}

	function buildFinalWave() {
		const host = $("#final-wave");
		const canvas = document.createElement("canvas");
		host.append(canvas);
		const ctx = canvas.getContext("2d");
		let w = 0;
		let h = 0;
		let dpr = 1;
		let mx = -1;
		let raf = 0;
		const resize = () => {
			dpr = Math.min(2, devicePixelRatio || 1);
			w = host.clientWidth;
			h = host.clientHeight;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
		};
		const section = $("#get");
		section.addEventListener("pointermove", (e) => {
			const r = host.getBoundingClientRect();
			mx = e.clientX - r.left;
		});
		section.addEventListener("pointerleave", () => (mx = -1));
		const draw = (now) => {
			raf = requestAnimationFrame(draw);
			const t = now / 1000;
			const [r, g, b] = cssColor("--accent");
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);
			const gap = 9;
			const bw = 4;
			const n = Math.floor(w / gap);
			for (let i = 0; i < n; i++) {
				const x = i * gap + (w - n * gap) / 2;
				let a = 0.35 + 0.35 * Math.sin(i * 0.18 - t * 1.6) * Math.sin(i * 0.05 + t * 0.6);
				a += 0.25 * Math.abs(Math.sin(i * 0.9 + t * 4));
				if (mx >= 0) a += 0.9 * Math.exp(-((x - mx) ** 2) / (2 * 80 ** 2));
				const bh = Math.max(4, Math.min(h * 0.95, a * h * 0.6));
				const near = mx >= 0 ? Math.exp(-((x - mx) ** 2) / (2 * 120 ** 2)) : 0;
				ctx.fillStyle = `rgba(${r},${g},${b},${0.22 + near * 0.6})`;
				ctx.beginPath();
				ctx.roundRect(x, (h - bh) / 2, bw, bh, bw / 2);
				ctx.fill();
			}
		};
		resize();
		addEventListener("resize", resize);
		new IntersectionObserver(([e]) => {
			cancelAnimationFrame(raf);
			if (e.isIntersecting) raf = requestAnimationFrame(draw);
		}).observe(host);
		if (reduced) setTimeout(() => cancelAnimationFrame(raf), 50);
	}

	// ── Footer: the wordmark, drawn as waveform bars ──────────────────────────

	async function buildBarWord() {
		const host = $("#bar-word");
		const canvas = $("canvas", host);
		const ctx = canvas.getContext("2d");
		try {
			await document.fonts.load('600 200px "Clash Display"');
		} catch {}
		let cols = [];
		let w = 0;
		let h = 0;
		let dpr = 1;
		let mx = -1e4;
		let my = -1e4;
		let raf = 0;
		let colW = 7;

		const build = () => {
			dpr = Math.min(2, devicePixelRatio || 1);
			w = host.clientWidth;
			h = host.clientHeight;
			// Finer bars for a smaller wordmark, so the letters stay readable.
			colW = Math.max(3, Math.round(h / 26));
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			const off = document.createElement("canvas");
			off.width = w;
			off.height = h;
			const o = off.getContext("2d");
			let size = h * 0.92;
			o.font = `600 ${size}px "Clash Display", sans-serif`;
			const tw = o.measureText("Voice Notes").width;
			if (tw > w) {
				size *= w / tw;
				o.font = `600 ${size}px "Clash Display", sans-serif`;
			}
			o.textBaseline = "middle";
			o.textAlign = "center";
			o.fillStyle = "#000";
			o.fillText("Voice Notes", w / 2, h / 2);
			const img = o.getImageData(0, 0, w, h).data;
			cols = [];
			for (let x = 0; x < w; x += colW) {
				const cx = Math.min(w - 1, x + Math.floor(colW / 2));
				let y0 = -1;
				for (let y = 0; y <= h; y++) {
					const on = y < h && img[(y * w + cx) * 4 + 3] > 120;
					if (on && y0 < 0) y0 = y;
					if (!on && y0 >= 0) {
						if (y - y0 > 2) cols.push({ x, y0, y1: y, seed: Math.random() * 6.28 });
						y0 = -1;
					}
				}
			}
		};

		host.addEventListener("pointermove", (e) => {
			const r = host.getBoundingClientRect();
			mx = e.clientX - r.left;
			my = e.clientY - r.top;
		});
		host.addEventListener("pointerleave", () => {
			mx = -1e4;
			my = -1e4;
		});

		const draw = (now) => {
			raf = requestAnimationFrame(draw);
			const t = now / 1000;
			const ink = cssColor("--ink");
			const acc = cssColor("--accent");
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);
			const bw = colW * 0.62;
			for (const c of cols) {
				const cx = c.x + colW / 2;
				const cy = (c.y0 + c.y1) / 2;
				const d = Math.hypot(cx - mx, cy - my);
				const near = Math.exp(-(d * d) / (2 * 70 * 70));
				const wob = near * 0.35 * Math.sin(t * 9 + c.seed);
				const len = (c.y1 - c.y0) * (1 + wob);
				const col = near > 0.05 ? acc.map((v, i) => Math.round(ink[i] + (v - ink[i]) * near)) : ink;
				ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.9})`;
				ctx.beginPath();
				ctx.roundRect(c.x + (colW - bw) / 2, cy - len / 2, bw, len, bw / 2);
				ctx.fill();
			}
		};

		build();
		let rt;
		addEventListener("resize", () => {
			clearTimeout(rt);
			rt = setTimeout(build, 120);
		});
		new IntersectionObserver(([e]) => {
			cancelAnimationFrame(raf);
			if (e.isIntersecting) raf = requestAnimationFrame(draw);
		}).observe(host);
	}

	// ── Appearance ────────────────────────────────────────────────────────────

	function currentTheme() {
		const t = document.documentElement.getAttribute("data-theme");
		return t === "light" || t === "dark" ? t : "auto";
	}

	function wireTheme() {
		const seg = $("#theme-seg");
		const sync = (animate) => {
			for (const b of $$("[data-theme-opt]", seg)) b.setAttribute("aria-checked", String(b.dataset.themeOpt === currentTheme()));
			layoutSeg(seg, animate);
		};
		for (const b of $$("[data-theme-opt]", seg))
			b.addEventListener("click", () => {
				const pref = b.dataset.themeOpt;
				if (pref === "auto") document.documentElement.removeAttribute("data-theme");
				else document.documentElement.setAttribute("data-theme", pref);
				try {
					if (pref === "auto") localStorage.removeItem("vn-theme");
					else localStorage.setItem("vn-theme", pref);
				} catch {}
				sync(true);
				dispatchEvent(new Event("vn-theme"));
			});
		document.fonts?.ready.then(() => sync(false));
		requestAnimationFrame(() => sync(false));
	}

	// ── Nav: a thumb that follows the section you're in ───────────────────────

	function buildNav() {
		const links = $$("#nav-links a");
		const thumb = $(".nav-thumb");
		const move = (a) => {
			if (!a) {
				thumb.style.opacity = "0";
				return;
			}
			thumb.style.opacity = "1";
			thumb.style.width = `${a.offsetWidth}px`;
			thumb.style.transform = `translateX(${a.offsetLeft}px)`;
		};
		let currentLink = null;
		for (const a of links) {
			a.addEventListener("mouseenter", () => move(a));
		}
		$("#nav-links").addEventListener("mouseleave", () => move(currentLink));
		const sections = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					const a = links.find((l) => l.getAttribute("href") === `#${e.target.id}`) || null;
					links.forEach((l) => l.classList.toggle("current", l === a));
					currentLink = a;
					move(currentLink);
				}
			},
			{ rootMargin: "-45% 0px -50% 0px" },
		);
		for (const s of sections) io.observe(s);
		// Clear the thumb when back in the hero.
		new IntersectionObserver(
			([e]) => {
				if (e.isIntersecting) {
					links.forEach((l) => l.classList.remove("current"));
					currentLink = null;
					move(null);
				}
			},
			{ rootMargin: "-45% 0px -50% 0px" },
		).observe($("#hero"));
	}

	function stickyNav() {
		const nav = $("#nav");
		const sentinel = document.createElement("div");
		sentinel.style.cssText = "position:absolute;top:0;height:1px;width:1px;pointer-events:none";
		document.body.prepend(sentinel);
		new IntersectionObserver(([e]) => nav.classList.toggle("is-stuck", !e.isIntersecting)).observe(sentinel);
	}

	function reveals() {
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					e.target.classList.add("in");
					io.unobserve(e.target);
				}
			},
			{ threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
		);
		for (const el of $$(".reveal")) io.observe(el);
	}

	// ── Release info ──────────────────────────────────────────────────────────

	async function releaseInfo() {
		let data = null;
		try {
			data = JSON.parse(sessionStorage.getItem("vn-release") || "null");
		} catch {}
		if (!data) {
			try {
				const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
					headers: { Accept: "application/vnd.github+json" },
				});
				if (!r.ok) return;
				const j = await r.json();
				const dmg = (j.assets || []).find((a) => a.name.endsWith(".dmg"));
				data = { tag: j.tag_name, size: dmg?.size ?? null };
				try {
					sessionStorage.setItem("vn-release", JSON.stringify(data));
				} catch {}
			} catch {
				return;
			}
		}
		if (data.tag) {
			for (const el of $$("[data-version]")) el.textContent = data.tag;
			for (const el of $$("[data-version-plain]")) el.textContent = data.tag.replace(/^v/, "");
		}
		if (data.size) {
			const mb = Math.round(data.size / 1_000_000);
			for (const el of $$("[data-size]")) el.textContent = `, about ${mb} MB`;
		}
	}

	function init() {
		paintIcons();
		buildHero();
		buildDemo();
		wireTray();
		buildPipe();
		buildBento();
		buildLanguages();
		buildSnippets();
		buildFinalWave();
		buildBarWord();
		wireTheme();
		buildNav();
		stickyNav();
		reveals();
		for (const a of $$("[data-download]")) a.href = DMG_URL;
		releaseInfo();

		// ?og renders the social card (see scripts/build-og.sh): dark, no nav, playing.
		if (new URLSearchParams(location.search).has("og")) {
			document.documentElement.setAttribute("data-theme", "dark");
			document.documentElement.classList.add("og");
			dispatchEvent(new Event("vn-theme"));
			toggleHero(true);
		}
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
})();
