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

	const stroke = (paths) =>
		`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

	const ICONS = {
		play: '<svg viewBox="0 0 20 20"><path d="M7.5 5.2v9.6l7.6-4.8z" fill="currentColor"/></svg>',
		pause:
			'<svg viewBox="0 0 20 20" fill="currentColor"><rect x="6" y="5" width="2.8" height="10" rx="1"/><rect x="11.2" y="5" width="2.8" height="10" rx="1"/></svg>',
		back: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5L6.5 10l5.5 5.5"/></svg>',
		pin: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 3.5h5l-.8 4.6 2.8 2.9H5.5l2.8-2.9z"/><path d="M10 11v5.5"/></svg>',
		copy: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="9" height="9" rx="2"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/></svg>',
		check: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10.5l3 3 7-7"/></svg>',
		send: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15.5v-11M5.5 9L10 4.5 14.5 9"/></svg>',
		retry: stroke('<path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9"/><path d="M14.5 3.5v3h-3"/>'),
		trash: stroke(
			'<path d="M4.5 6h11M8 6V4.5h4V6"/><path d="M6 6l.7 9.2a1.5 1.5 0 0 0 1.5 1.3h3.6a1.5 1.5 0 0 0 1.5-1.3L14 6"/>',
		),
		sliders: stroke('<path d="M4 6h5M13 6h3M4 14h2M10 14h6"/><circle cx="11" cy="6" r="2"/><circle cx="8" cy="14" r="2"/>'),
		search: stroke('<circle cx="9" cy="9" r="4.75"/><path d="M12.5 12.5L16 16"/>'),
		close: stroke('<path d="M6.5 6.5l7 7M13.5 6.5l-7 7"/>'),
		chevron: stroke('<path d="M6.5 8.5L10 12l3.5-3.5"/>'),
		clock: stroke('<circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.4 1.6"/>'),
		minus: stroke('<path d="M5.5 10h9"/>'),
		plus: stroke('<path d="M10 5.5v9M5.5 10h9"/>'),
		folder: stroke(
			'<path d="M3.5 6.5a2 2 0 0 1 2-2h3l1.5 1.8h4.5a2 2 0 0 1 2 2v5.7a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z"/>',
		),
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

	// A timed line, as the app's transcripts carry them: when it starts, what
	// was said, and the English when it was said in another language.
	const line = (start, text, english = "") => ({ start, text, english });

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
			segments: [
				line(0.4, "Hi! Quick one about the bakery site."),
				line(3.2, "Can we swap the big photo at the top for the croissant shot? People love that one."),
				line(10.6, "Also, move the opening hours higher up, everyone keeps calling to ask."),
				line(18.1, "And what would it cost to add online orders?"),
				line(23.4, "If you can send me a quote by Friday, that'd be great."),
			],
			replies: {
				"Draft a reply":
					"Hi! Sure, I'll swap in the croissant shot and move the opening hours up today. For online orders, I'll put a quote together and send it before Friday.",
				"Reply in English":
					"It's already in English, so here's a shorter one: Will do both today. Quote for online orders coming before Friday.",
				"What's urgent?":
					"**The quote.** They want it by Friday. The photo swap and the opening hours are quick fixes you can do today.",
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
			segments: [
				line(
					0.4,
					"Hi! Pwede ba nating ilipat yung pricing section sa taas ng testimonials?",
					"Hi! Can we move the pricing section above the testimonials?",
				),
				line(8.8, "Mas gusto ko kasi na makita agad ng tao yung presyo.", "I'd rather people see the prices right away."),
				line(
					16.5,
					"Tapos yung client natin sa Dubai, gusto nila yung Arabic version ng landing page by Thursday.",
					"Also, our client in Dubai wants the Arabic version of the landing page by Thursday.",
				),
				line(31.8, "Send mo sakin yung staging link pag ready na, salamat!", "Send me the staging link when it's ready, thanks!"),
			],
			replies: {
				"Draft a reply":
					"Sige! Ililipat ko na yung **pricing** sa taas ng testimonials ngayon.\n\n- Arabic version: on track for Thursday\n- Staging link: send ko agad pag live na",
				"Reply in English":
					"Sure! I'll move pricing above the testimonials today. The Arabic version is on track for Thursday, and I'll send the staging link as soon as it's live.",
				"What's urgent?": "**The Arabic landing page,** due Thursday. Moving the pricing section is a quick change.",
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
			segments: [
				line(0.4, "مرحبا! Just checking on the menu photos.", "Hi! Just checking on the menu photos."),
				line(6.3, "هل يمكن أن نضيف صور الحلويات قبل يوم السبت؟", "Can we add the dessert photos before Saturday?"),
				line(14.9, "And please send the invoice to my email, not WhatsApp."),
				line(24.2, "شكرا!", "Thanks!"),
			],
			replies: {
				"Draft a reply":
					"مرحبا! Yes, the dessert photos will be up before Saturday. I'll email you the invoice today. شكرا!",
				"Reply in English":
					"Hi! Yes, the dessert photos will be up before Saturday, and I'll email you the invoice today. Thanks!",
				"What's urgent?": "**The dessert photos,** due before Saturday. The invoice just needs to go by email.",
				"Make a task list": "1. Add the dessert photos before Saturday\n2. Email the invoice",
			},
		},
	];

	// Already in the window when the page opens, both read.
	const OLDER = [
		{
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
			segments: [
				line(0.3, "Hey, just listened back to everything."),
				line(3.6, "Love the new logo, honestly."),
				line(7.1, "Can you put it on the invoice template as well?"),
				line(12.8, "And when do you think the business cards will be ready?"),
			],
			replies: {
				"Draft a reply":
					"Thank you! I'll add the logo to the invoice template today. The business cards should be ready early next week, I'll confirm the exact day tomorrow.",
				"Reply in English": "It's already in English. Shorter: Thanks! Logo goes on the invoice today, cards early next week.",
				"What's urgent?": "Nothing has a deadline. Giving them a date for the business cards is the open question.",
				"Make a task list": "1. Add the new logo to the invoice template\n2. Confirm a date for the business cards",
			},
		},
		{
			id: "checkout",
			when: "Thursday, 6:05 PM",
			duration: 46,
			language: "English",
			summary:
				"They want the checkout button moved higher on mobile and ask whether Apple Pay can be added before the launch.",
			actionItems: ["Move the checkout button higher on mobile", "Check whether Apple Pay can ship before launch"],
			questions: ["Is Apple Pay possible before the launch?"],
			transcript:
				"On mobile the checkout button is too far down, people keep missing it. Can we move it up?\n\nAlso, is Apple Pay possible before the launch? It would help a lot with repeat orders.",
			english: "",
			segments: [
				line(0.5, "On mobile the checkout button is too far down, people keep missing it."),
				line(8.2, "Can we move it up?"),
				line(12.9, "Also, is Apple Pay possible before the launch?"),
				line(19.6, "It would help a lot with repeat orders."),
			],
			replies: {
				"Draft a reply":
					"Good catch! I'll move the checkout button up on mobile today. Apple Pay is doable before launch, I'll confirm the timeline by tomorrow.",
				"Reply in English": "It's already in English. Shorter: Moving the checkout button up today, Apple Pay timeline by tomorrow.",
				"What's urgent?": "**Apple Pay,** since it depends on the launch date. The checkout button is a quick fix.",
				"Make a task list":
					"1. Move the checkout button higher on mobile\n2. Check whether Apple Pay can ship before launch\n3. Confirm the timeline with them",
			},
		},
	];

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

		// How loud the voice is: overlapping swells, like phrases and words
		// rising and falling, without the syllable-by-syllable jitter.
		const t = hero.t;
		const phrase = 0.5 + 0.5 * Math.sin(t * 1.7 + 0.6);
		const word = 0.5 + 0.5 * Math.sin(t * 3.4 + 1.9);
		const lilt = 0.5 + 0.5 * Math.sin(t * 5.7 + 0.4);
		window.vnLevel = Math.min(1, 0.36 + phrase * 0.36 + word * 0.2 + lilt * 0.1);

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
	// Mirrors src/mainview: the title bar and its screens (App), the list with
	// search (NoteList), a note (NoteView, Player, Chat), the scene while a note
	// is transcribed (Listening) and Settings. Nothing leaves the page, and a
	// transcription takes seconds instead of half a minute.

	const APP_VERSION = "0.2.3";
	let appVersion = APP_VERSION;
	/** Seconds the end of the listening scene takes (Listening.tsx IMPLODE_S). */
	const IMPLODE_S = 1.05;
	/** There's no audio here, so playback runs twice as fast as the clock. */
	const PLAY_SPEED = 2;
	const RATES = [1, 1.5, 2];
	const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
	const DEFAULT_PATTERN = "^WhatsApp.*\\.(opus|ogg|m4a|mp3|aac)$";
	const MODELS = [
		{ id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
		{ id: "gemini-4-argon", label: "Gemini 4 Argon" },
	];
	const EFFORT_LABEL = { low: "Low", medium: "Medium", high: "High" };
	const TAB_LABEL = { summary: "Summary", transcript: "Transcript", chat: "Chat" };
	const FALLBACK_REPLY =
		"In the app, Antigravity answers this from the transcript. On this page, try one of the options above the message box.";

	const vn = {
		notes: [], // { ...sample, status, read, timed, done: [], chat: [], pending }
		page: "list", // list | note | settings
		id: null,
		tab: "summary",
		txLang: "original",
		pinned: true,
		query: "",
		rate: 1,
		queue: [],
		working: null,
		started: false, // a sample has been downloaded, by hand or on scroll
		update: "idle", // idle | checking | done
		prefs: { model: MODELS[0].id, effort: "low", timed: true, keep: true, days: 7, pattern: DEFAULT_PATTERN },
		scene: null, // the listening scene on screen
		pb: null, // playback of the open note
	};

	const isPending = (n) => n.status === "queued" || n.status === "processing";
	const current = () => (vn.page === "note" ? vn.notes.find((n) => n.id === vn.id) || null : null);
	const liveView = () => $("#vn-body > .vn-view:not(.out)");
	const termsOf = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
	const daysLabel = (d) => `${d} day${d === 1 ? "" : "s"}`;
	const spinner = (size = 14) =>
		`<svg class="vn-spin" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="2"/><path d="M17 10a7 7 0 0 0-7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
	const ib = (name, label, act, pressed) =>
		`<button class="vn-ib press${pressed ? " active" : ""}" type="button" data-act="${act}" aria-label="${label}" title="${label}"${
			pressed === undefined ? "" : ` aria-pressed="${pressed}"`
		}>${icon(name)}</button>`;
	const copyBtn = (kind, label) =>
		`<button class="vn-copy press" type="button" data-copy="${kind}">${icon("copy")}<span>${label}</span></button>`;
	const isDark = () => {
		const t = document.documentElement.getAttribute("data-theme");
		return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
	};

	function makeNote(sample, status, read = false) {
		return { ...sample, status, read, timed: true, done: sample.actionItems.map(() => false), chat: [], pending: false };
	}

	// Timestamp for a transcript line: 0:07 (format.ts stamp).
	const stamp = (s) => {
		const t = Math.max(0, Math.floor(s));
		return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
	};

	function toSrt(segments) {
		const p = (n, w = 2) => String(n).padStart(w, "0");
		const t = (s) => {
			const ms = Math.max(0, Math.round(s * 1000));
			return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
		};
		return segments
			.map((s, i) => `${i + 1}\n${t(s.start)} --> ${t(Math.max(s.end, s.start + 0.5))}\n${s.text}\n`)
			.join("\n");
	}

	/** Index of the line being spoken at `time`, or -1 before the first one. */
	function activeIndex(spans, time) {
		let found = -1;
		for (let i = 0; i < spans.length; i++) {
			if (spans[i].start <= time) found = i;
			else break;
		}
		return found;
	}

	/** Without timings, each paragraph gets a share of the audio by its length. */
	function estimateSpans(paras, total) {
		const lengths = paras.map((p) => Math.max(1, p.length));
		const sum = lengths.reduce((a, b) => a + b, 0);
		let at = 0;
		return lengths.map((len) => {
			const start = at;
			at += (len / sum) * total;
			return { start, end: at };
		});
	}

	/** Small, escape-first markdown for chat replies (format.ts markdown). */
	function markdown(src) {
		const inline = (s) =>
			s
				.replace(/`([^`]+)`/g, "<code>$1</code>")
				.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
				.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
		return esc(src)
			.split(/\n{2,}/)
			.map((para) => {
				const lines = para.split("\n");
				if (lines.every((l) => /^\s*[-*•]\s+/.test(l)))
					return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
				if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
					return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
				return `<p>${inline(para).replace(/\n/g, "<br>")}</p>`;
			})
			.join("");
	}

	/**
	 * A reply writes itself in: each word fades up a beat after the one before
	 * (Chat.tsx writeIn). Returns how long the whole reply takes, in ms.
	 */
	function writeIn(root) {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		const texts = [];
		while (walker.nextNode()) texts.push(walker.currentNode);
		const total = texts.reduce((n, t) => n + (t.data.match(/\S+/g)?.length ?? 0), 0);
		const step = Math.min(22, 1400 / Math.max(1, total));
		let n = 0;
		for (const t of texts) {
			const frag = document.createDocumentFragment();
			for (const part of t.data.split(/(\s+)/)) {
				if (!part) continue;
				if (!part.trim()) {
					frag.append(part);
					continue;
				}
				const w = document.createElement("span");
				w.className = "reply-word";
				w.style.setProperty("--d", `${Math.round(n++ * step)}ms`);
				w.textContent = part;
				frag.append(w);
			}
			t.replaceWith(frag);
		}
		// A list bullet comes in with its item's first word, not before it.
		for (const li of root.querySelectorAll("li")) {
			const first = li.querySelector(".reply-word");
			if (!first) continue;
			li.classList.add("reply-li");
			li.style.setProperty("--d", first.style.getPropertyValue("--d"));
		}
		return n * step + 560;
	}

	async function copyFeedback(btn, text) {
		const label = $("span:last-child", btn);
		btn._label ??= label.textContent;
		const ok = await copyText(text);
		btn.classList.add("done");
		$("[data-icon]", btn).innerHTML = ICONS[ok ? "check" : "copy"];
		label.textContent = ok ? "Copied" : "Couldn't copy";
		clearTimeout(btn._timer);
		btn._timer = setTimeout(() => {
			btn.classList.remove("done");
			$("[data-icon]", btn).innerHTML = ICONS.copy;
			label.textContent = btn._label;
		}, 1400);
	}

	function copySource(n, kind) {
		const english = vn.txLang === "english" && !!n.english;
		if (kind === "summary") return noteAsText(n, false);
		if (kind === "full") return noteAsText(n, true);
		if (kind === "tx") return english ? n.english : n.transcript;
		if (kind === "srt") {
			const segs = n.segments.map((s, i) => ({
				start: s.start,
				end: n.segments[i + 1]?.start ?? n.duration,
				text: english ? s.english || s.text : s.text,
			}));
			return toSrt(segs);
		}
		return n.chat[Number(kind.split(":")[1])]?.text ?? "";
	}

	// ── Building the window ───────────────────────────────────────────────────

	function buildDemo() {
		vn.notes = OLDER.map((s) => makeNote(s, "done", true));
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
		for (const row of $$(".dl-row", dl)) $(".dl-btn", row).addEventListener("click", () => download(row));

		const win = $("#vn");
		win.innerHTML = `
			<header class="vn-head">
				<div class="vn-lights" aria-hidden="true"><i></i><i></i><i></i></div>
				<div class="vn-back-slot"></div>
				<h1 class="vn-title">Voice notes</h1>
				<div class="vn-actions"></div>
			</header>
			<div class="vn-body" id="vn-body"></div>
			<div class="vn-toast-slot"></div>`;
		$(".vn-head", win).addEventListener("click", onHeadClick);
		win.addEventListener("keydown", (e) => {
			if (e.key !== "Escape") return;
			if ($(".vn-confirm", win)) closeConfirm();
			else if (vn.page !== "list") go("list");
		});
		// Lists feather out under the title bar once scrolled (useScrollEdges).
		win.addEventListener(
			"scroll",
			(e) => {
				const el = e.target;
				if (!(el instanceof HTMLElement) || !el.classList.contains("scroll-soft")) return;
				const s = String(el.scrollTop > 4);
				if (el.dataset.scrolled !== s) el.dataset.scrolled = s;
			},
			{ capture: true, passive: true },
		);
		renderHead(false);
		mountView(true);
		buildTray();
		fitDesk();
		new ResizeObserver(fitDesk).observe($("#desk-stage"));
		tickClock();
		setInterval(tickClock, 15_000);
		watchDesk();
	}

	function tickClock() {
		const d = new Date();
		$("#dm-clock").textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	}

	// The desk is a fixed-height scene. It widens with its column up to 900px
	// (more desktop around the window), and below 680px it's scaled to fit. On
	// narrow screens it shrinks to just around the window so the window stays readable.
	function fitDesk() {
		const stage = $("#desk-stage");
		const desk = $("#desk");
		const w = stage.clientWidth;
		const deskW = w < 520 ? 420 : Math.round(Math.min(900, Math.max(680, w)));
		desk.style.width = `${deskW}px`;
		$("#vn").style.right = deskW === 420 ? "20px" : "24px";
		const scale = Math.min(1, w / deskW);
		desk.style.left = `${Math.max(0, (w - deskW * scale) / 2)}px`;
		stage.style.setProperty("--desk-scale", String(scale));
		stage.style.setProperty("--desk-h", "680px");
	}

	// The scene only draws while the desk is on screen. The first sample
	// downloads itself the first time the desk comes into view.
	let deskOnScreen = true;
	function watchDesk() {
		const stage = $("#desk-stage");
		new IntersectionObserver(([e]) => (deskOnScreen = e.isIntersecting)).observe(stage);
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				setTimeout(
					() => {
						if (vn.started) return;
						const row = $("#downloads .dl-row");
						const btn = $(".dl-btn", row);
						btn.classList.add("is-pressed");
						setTimeout(() => btn.classList.remove("is-pressed"), 160);
						download(row);
					},
					reduced ? 0 : 500,
				);
			},
			{ threshold: 0.5 },
		);
		io.observe(stage);
	}

	// ── Title bar and screens (App.tsx) ───────────────────────────────────────

	function onHeadClick(e) {
		const b = e.target.closest("[data-act]");
		if (!b) return;
		const act = b.dataset.act;
		if (act === "back") go("list");
		else if (act === "settings") go("settings");
		else if (act === "pin") setPinned(!vn.pinned);
		else if (act === "trash") openConfirm();
		else if (act === "retry") {
			const n = current();
			if (n) transcribe(n);
		}
	}

	function renderHead(swap) {
		const head = $(".vn-head");
		const n = current();
		const title = vn.page === "settings" ? "Settings" : n ? n.when : "Voice notes";
		const old = $(".vn-title", head);
		if (swap) {
			const t = document.createElement("h1");
			t.className = "vn-title vn-swap";
			t.textContent = title;
			old.replaceWith(t);
		} else old.textContent = title;
		const slot = $(".vn-back-slot", head);
		if (vn.page === "list") slot.innerHTML = "";
		else if (!slot.firstChild) slot.innerHTML = `<span class="vn-swap">${ib("back", "All voice notes", "back")}</span>`;
		renderActions();
	}

	function renderActions() {
		const box = $(".vn-actions");
		if (vn.page === "settings") {
			if (!$(".vn-saved", box)) box.innerHTML = "";
			return;
		}
		const n = current();
		let html = "";
		if (vn.page === "note") {
			if (n && n.status === "done") html += ib("retry", "Transcribe again", "retry");
			html += ib("trash", "Delete voice note", "trash");
		} else html += ib("sliders", "Settings", "settings");
		html += ib("pin", vn.pinned ? "Stop keeping on top" : "Keep on top", "pin", vn.pinned);
		box.innerHTML = html;
	}

	function setPinned(p) {
		vn.pinned = p;
		renderActions();
		buildTray();
	}

	// The window dims while the open note is being transcribed.
	function setImmersive() {
		const n = current();
		$("#vn").classList.toggle("immersive", !!n && isPending(n));
	}

	/** Moves to another screen: the old one clears in a few frames, the new one slides in a beat later. */
	function go(page, id = null) {
		if (vn.page === page && vn.id === id) return;
		const dir = page === "list" ? -1 : 1;
		const old = liveView();
		if (old) {
			old.classList.remove("in");
			old.classList.add("out");
			old.style.setProperty("--dir", dir);
			old.setAttribute("aria-hidden", "true");
			old.inert = true;
			setTimeout(() => old.remove(), 140);
		}
		stopPlayback();
		endScene();
		closeConfirm();
		vn.page = page;
		vn.id = id;
		vn.tab = "summary";
		vn.txLang = "original";
		vn.query = "";
		setImmersive();
		renderHead(true);
		mountView(false, dir);
	}

	function mountView(initial, dir = 1) {
		const view = document.createElement("div");
		view.className = `vn-view${initial ? "" : " in"}`;
		view.style.setProperty("--dir", dir);
		$("#vn-body").append(view);
		renderView(view);
	}

	function renderView(view, reveal = false) {
		if (vn.page === "list") listView(view);
		else if (vn.page === "settings") settingsView(view);
		else noteView(view, reveal);
	}

	// ── The list (NoteList.tsx) ───────────────────────────────────────────────

	function listView(view) {
		if (!vn.notes.length) {
			view.innerHTML = `
				<div class="vn-scroll scroll-soft vn-list">
					<div class="vn-empty">
						<div class="vn-empty-bars vn-rise" aria-hidden="true">${[10, 18, 28, 16, 24, 34, 20, 12, 22, 14]
							.map((h) => `<i style="height:${h}px"></i>`)
							.join("")}</div>
						<h2 class="vn-rise" style="--i:1">No voice notes yet</h2>
						<p class="vn-rise" style="--i:2">Download a voice note in WhatsApp and it opens here, transcribed.</p>
					</div>
					<div class="vn-foot"></div>
				</div>`;
			renderFoot(view);
			return;
		}
		view.innerHTML = `
			<div class="vn-search vn-rise">
				<label class="vn-search-box">
					<span class="sr-only">Search voice notes</span>
					${icon("search")}
					<input type="text" data-q placeholder="Search voice notes" spellcheck="false" autocomplete="off" />
					<button type="button" class="vn-clear press" data-clear aria-label="Clear search" hidden>${icon("close")}</button>
				</label>
			</div>
			<div class="vn-scroll scroll-soft vn-list">
				<ul class="vn-panel vn-rows"></ul>
				<div class="vn-nomatch" hidden></div>
				<div class="vn-foot"></div>
			</div>`;
		const q = $("[data-q]", view);
		const clear = $("[data-clear]", view);
		const set = (value) => {
			vn.query = value;
			if (q.value !== value) q.value = value;
			clear.hidden = !value;
			syncRows(view, true);
		};
		q.addEventListener("input", () => set(q.value));
		q.addEventListener("keydown", (e) => {
			if (e.key !== "Escape") return;
			e.stopPropagation();
			if (q.value) set("");
			else q.blur();
		});
		clear.addEventListener("click", () => {
			set("");
			q.focus({ preventScroll: true });
		});
		$(".vn-rows", view).addEventListener("click", (e) => {
			const b = e.target.closest("[data-open]");
			if (b) go("note", b.dataset.open);
		});
		$(".vn-nomatch", view).addEventListener("click", (e) => {
			if (!e.target.closest("[data-clear-search]")) return;
			set("");
			q.focus({ preventScroll: true });
		});
		renderFoot(view);
		syncRows(view, false);
	}

	/** Search runs over the summary, transcript, to-dos, questions and the date in the list. */
	function searchNote(n, terms) {
		const when = n.when.toLowerCase();
		if (n.status !== "done") return terms.every((t) => when.includes(t)) ? "" : null;
		const all = [when, n.summary, n.transcript, n.english, ...n.actionItems, ...n.questions].join(" ").toLowerCase();
		if (!terms.every((t) => all.includes(t))) return null;
		// Shown as the summary when it has every word, otherwise as a line from where they are.
		const top = `${when} ${n.summary}`.toLowerCase();
		const missing = terms.find((t) => !top.includes(t));
		if (!missing) return "";
		const src = [n.transcript, n.english, ...n.actionItems, ...n.questions].find((f) => f.toLowerCase().includes(missing));
		const flat = src.replace(/\s+/g, " ");
		const at = flat.toLowerCase().indexOf(missing);
		const from = Math.max(0, at - 36);
		const to = Math.min(flat.length, at + missing.length + 64);
		let s = flat.slice(from, to);
		if (from > 0) s = `…${s.replace(/^\S*\s/, "")}`;
		if (to < flat.length) s = `${s.replace(/\s\S*$/, "")}…`;
		return s;
	}

	function highlight(text, terms) {
		if (!terms.length) return esc(text);
		const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
		return text
			.split(re)
			.map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)))
			.join("");
	}

	/**
	 * One voice note in the list. Unread: a violet dot, a bolder time and the
	 * summary at full strength. Transcribing: a pulsing dot and a light sweeping
	 * through the row. Waiting: a violet ring.
	 */
	function rowHTML(n, snippet, terms) {
		const done = n.status === "done";
		const unread = done && !n.read;
		const sub = done
			? `<p class="vn-row-sub${unread ? " unread" : ""}">${snippet ? `<i>${highlight(snippet, terms)}</i>` : highlight(n.summary, terms)}</p>`
			: n.status === "processing"
				? `<p class="vn-status busy"><span class="vn-dot busy" aria-hidden="true"></span>Transcribing</p>`
				: `<p class="vn-status"><span class="vn-dot queued" aria-hidden="true"></span>Waiting to transcribe</p>`;
		return `<button class="vn-row press-soft${n.status === "processing" ? " row-scan" : ""}" type="button" data-open="${n.id}"${
			unread ? ` aria-label="${esc(n.when)}, unread"` : ""
		}>
			<span class="vn-row-top">
				<span class="vn-when${unread ? " unread" : ""}">${unread ? '<span class="vn-dot unread" aria-hidden="true"></span>' : ""}<span>${highlight(n.when, terms)}</span></span>
				<span class="vn-dur">${clock(n.duration)}</span>
			</span>
			${sub}
		</button>`;
	}

	/**
	 * The list, animated as it changes: rows that leave fold away in place,
	 * rows that arrive open up one after another (NoteList.tsx Rows).
	 */
	function syncRows(view, animate) {
		const ul = $(".vn-rows", view);
		if (!ul) return;
		const terms = termsOf(vn.query);
		const hits = terms.length ? new Map() : null;
		if (hits)
			for (const n of vn.notes) {
				const s = searchNote(n, terms);
				if (s !== null) hits.set(n.id, s);
			}
		const list = hits ? vn.notes.filter((n) => hits.has(n.id)) : vn.notes;
		const want = new Set(list.map((n) => n.id));
		const motion = animate && !reduced;

		for (const li of [...ul.children]) {
			if (li.dataset.leaving || want.has(li.dataset.id)) continue;
			if (!motion) {
				li.remove();
				continue;
			}
			li.dataset.leaving = "1";
			li.setAttribute("aria-hidden", "true");
			li.style.pointerEvents = "none";
			li.animate(
				[
					{ height: `${li.offsetHeight}px`, opacity: 1, filter: "blur(0)" },
					{ height: "0px", opacity: 0, filter: "blur(4px)", borderTopWidth: "0px" },
				],
				{ duration: 260, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
			).onfinish = () => li.remove();
		}

		let prev = null;
		let entering = 0;
		list.forEach((n, i) => {
			let li = ul.querySelector(`li[data-id="${n.id}"]:not([data-leaving])`);
			const fresh = !li;
			if (fresh) {
				li = document.createElement("li");
				li.dataset.id = n.id;
			}
			const html = rowHTML(n, hits?.get(n.id) ?? "", terms);
			if (li._html !== html) {
				li.innerHTML = html;
				li._html = html;
			}
			// Keep rows that are leaving where they were.
			let ref = prev ? prev.nextSibling : ul.firstChild;
			while (ref && ref !== li && ref.dataset.leaving) ref = ref.nextSibling;
			if (ref !== li) ul.insertBefore(li, ref);
			if (fresh && !animate) {
				li.className = "vn-rise";
				li.style.setProperty("--i", String(Math.min(i, 10)));
			} else if (fresh && motion) {
				const h = li.offsetHeight;
				li.animate(
					[
						{ height: "0px", opacity: 0, transform: "translateY(6px)", filter: "blur(5px)" },
						{ height: `${h}px`, opacity: 1, transform: "none", filter: "blur(0)" },
					],
					{ duration: 380, delay: Math.min(entering++, 6) * 35, easing: EASE, fill: "backwards" },
				);
			}
			prev = li;
		});

		const none = terms.length > 0 && list.length === 0;
		const nm = $(".vn-nomatch", view);
		nm.hidden = !none;
		nm.innerHTML = none
			? `<div class="vn-swap">
				<p class="vn-nomatch-t">No voice notes match “${esc(vn.query.trim())}”</p>
				<p>Search looks through summaries, transcripts, to-dos and dates.</p>
				<button class="vn-btn press" type="button" data-clear-search>Clear search</button>
			</div>`
			: "";
		$(".vn-foot", view).hidden = terms.length > 0;
	}

	function renderFoot(view) {
		const foot = $(".vn-foot", view);
		if (!foot) return;
		const checking = vn.update === "checking";
		const label = checking ? "Checking…" : vn.update === "done" ? "Up to date" : "Check for updates";
		foot.innerHTML = `<span class="vn-ver">Voice Notes ${esc(appVersion)}</span><span class="vn-ver" aria-hidden="true">·</span>
			<button class="vn-check press" type="button" data-check${checking ? " disabled" : ""}>${checking ? spinner(11) : ""}${label}</button>`;
		$("[data-check]", foot).addEventListener("click", checkUpdates);
	}

	const refreshFoot = () => {
		const v = liveView();
		if (v && vn.page === "list") renderFoot(v);
	};

	async function checkUpdates() {
		if (vn.update === "checking") return;
		vn.update = "checking";
		refreshFoot();
		buildTray();
		await sleep(reduced ? 300 : 1200);
		vn.update = "done";
		refreshFoot();
		buildTray();
	}

	// ── A note (NoteView.tsx, Player.tsx) ─────────────────────────────────────

	function noteView(view, reveal) {
		const n = current();
		if (!n) return;
		if (isPending(n)) {
			view.innerHTML = "";
			vn.scene = createScene(n, false);
			view.append(vn.scene.el);
			return;
		}
		n.read = true;
		view.innerHTML = `
			<div class="vn-note">
				<div class="vn-top">
					<div data-reveal style="--r:0">${playerHTML(n)}</div>
					<div class="vn-tabs-row" data-reveal style="--r:1">
						<div class="seg" data-tabs role="radiogroup" aria-label="Sections">
							<span class="seg-thumb" aria-hidden="true"></span>
							${["summary", "transcript", "chat"]
								.map((t) => `<button type="button" role="radio" class="press" data-tab="${t}" aria-checked="${vn.tab === t}">${TAB_LABEL[t]}</button>`)
								.join("")}
						</div>
						${n.language ? `<span class="vn-lang">${esc(n.language)}</span>` : ""}
					</div>
				</div>
				<div class="vn-pane" data-pane></div>
			</div>`;
		wirePlayer(view, n);
		const tabs = $("[data-tabs]", view);
		requestAnimationFrame(() => layoutSeg(tabs, false));
		tabs.addEventListener("click", (e) => {
			const b = e.target.closest("[data-tab]");
			if (!b || vn.tab === b.dataset.tab) return;
			vn.tab = b.dataset.tab;
			segValue(tabs, "tab", vn.tab);
			renderPane(view, n, false);
		});
		renderPane(view, n, reveal);
	}

	function renderPane(view, n, reveal) {
		const pane = $("[data-pane]", view);
		if (vn.tab === "chat") {
			pane.innerHTML = chatHTML(n);
			wireChat(pane, n);
			return;
		}
		pane.innerHTML = `<div class="vn-scroll scroll-soft vn-tab vn-swap">${vn.tab === "summary" ? summaryHTML(n, reveal) : transcriptHTML(n)}</div>`;
		const box = $(".vn-tab", pane);
		const seg = $("[data-txlang]", box);
		if (seg) requestAnimationFrame(() => layoutSeg(seg, false));
		box.addEventListener("click", (e) => onTabClick(e, box, n));
		paintLine();
	}

	function onTabClick(e, box, n) {
		const item = e.target.closest("[data-item]");
		if (item) {
			const i = Number(item.dataset.item);
			n.done[i] = !n.done[i];
			item.classList.toggle("done", n.done[i]);
			item.setAttribute("aria-checked", String(n.done[i]));
			return;
		}
		const cp = e.target.closest("[data-copy]");
		if (cp) return void copyFeedback(cp, copySource(n, cp.dataset.copy));
		const lang = e.target.closest("[data-lang-opt]");
		if (lang) {
			if (vn.txLang === lang.dataset.langOpt) return;
			vn.txLang = lang.dataset.langOpt;
			segValue($("[data-txlang]", box), "langOpt", vn.txLang);
			const body = $("[data-txbody]", box);
			const next = document.createElement("div");
			next.className = "vn-swap";
			next.dataset.txbody = "";
			next.innerHTML = txBody(n);
			body.replaceWith(next);
			box._followed = null;
			paintLine();
			return;
		}
		const timings = e.target.closest("[data-add-timings]");
		if (timings) {
			timings.disabled = true;
			$("[data-icon]", timings).outerHTML = spinner(12);
			setTimeout(() => transcribe(n, true), reduced ? 0 : 500);
			return;
		}
		const at = e.target.closest("[data-seek-to]");
		if (at) return void play(Number(at.dataset.seekTo));
		// Tapping a line plays from there, unless you were selecting text.
		const row = e.target.closest(".vn-line");
		if (row && getSelection()?.isCollapsed !== false) play(n.segments[Number(row.dataset.line)].start);
	}

	function playerHTML(n) {
		return `<div class="vn-panel vn-player">
			<button class="vn-play press" type="button" data-play data-state="play" aria-label="Play">${icon("play")}</button>
			<div class="vn-bars" data-seek role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="${n.duration}" aria-valuenow="0">${shape(n.id, 34)
				.map((h) => `<i style="height:${h}px"></i>`)
				.join("")}</div>
			<span class="vn-time" data-time>${clock(n.duration)}</span>
			<button class="vn-rate press${vn.rate === 1 ? "" : " on"}" type="button" data-rate aria-label="Playback speed ${vn.rate} times. Change speed" title="Playback speed"><span>${vn.rate}×</span></button>
		</div>`;
	}

	function wirePlayer(view, n) {
		vn.pb = { id: n.id, time: 0, total: n.duration, playing: false, loaded: false, last: 0, raf: 0 };
		$("[data-play]", view).addEventListener("click", () => (vn.pb?.playing ? pause() : play()));
		const bars = $("[data-seek]", view);
		bars.addEventListener("click", (e) => {
			const r = bars.getBoundingClientRect();
			play(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * n.duration);
		});
		bars.addEventListener("keydown", (e) => {
			const p = vn.pb;
			if (!p) return;
			if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
				e.preventDefault();
				play(Math.min(p.total, Math.max(0, p.time + (e.key === "ArrowRight" ? 5 : -5))));
			} else if (e.key === " " || e.key === "Enter") {
				e.preventDefault();
				p.playing ? pause() : play();
			}
		});
		// The speed rolls up to its new value, and carries over to the next note.
		$("[data-rate]", view).addEventListener("click", (e) => {
			const b = e.currentTarget;
			vn.rate = RATES[(RATES.indexOf(vn.rate) + 1) % RATES.length];
			b.classList.toggle("on", vn.rate !== 1);
			b.setAttribute("aria-label", `Playback speed ${vn.rate} times. Change speed`);
			b.innerHTML = `<span class="vn-rate-in">${vn.rate}×</span>`;
		});
	}

	async function play(from) {
		const p = vn.pb;
		if (!p) return;
		if (!p.loaded) {
			p.loaded = true;
			const btn = $("[data-play]", liveView());
			if (btn && !reduced) {
				btn.dataset.state = "loading";
				btn.innerHTML = spinner(14);
				await sleep(240);
			}
			if (vn.pb !== p) return;
		}
		// A hair past the start, so the line you tapped is the one that lights up.
		if (from != null) p.time = Math.max(0, from + 0.01);
		if (p.time >= p.total) p.time = 0;
		if (!p.playing) {
			p.playing = true;
			p.last = performance.now();
			const step = (now) => {
				if (vn.pb !== p || !p.playing) return;
				p.time += ((now - p.last) / 1000) * vn.rate * PLAY_SPEED;
				p.last = now;
				if (p.time >= p.total) {
					p.playing = false;
					p.time = 0;
				}
				paintPlayer();
				paintLine();
				if (p.playing) p.raf = requestAnimationFrame(step);
			};
			p.raf = requestAnimationFrame(step);
		}
		paintPlayer();
		paintLine();
	}

	function pause() {
		const p = vn.pb;
		if (!p) return;
		p.playing = false;
		cancelAnimationFrame(p.raf);
		paintPlayer();
	}

	function stopPlayback() {
		if (vn.pb) {
			vn.pb.playing = false;
			cancelAnimationFrame(vn.pb.raf);
		}
		vn.pb = null;
	}

	function paintPlayer() {
		const p = vn.pb;
		const view = liveView();
		const btn = view && $("[data-play]", view);
		if (!p || !btn) return;
		const want = p.playing ? "pause" : "play";
		if (btn.dataset.state !== want) {
			btn.dataset.state = want;
			btn.innerHTML = icon(want);
			btn.setAttribute("aria-label", p.playing ? "Pause" : "Play");
		}
		const prog = p.total ? p.time / p.total : 0;
		const bars = $$("[data-seek] i", view);
		bars.forEach((b, i) => b.classList.toggle("on", i / bars.length < prog));
		const t = clock(p.playing || p.time ? p.time : p.total);
		const time = $("[data-time]", view);
		if (time.textContent !== t) time.textContent = t;
		$("[data-seek]", view).setAttribute("aria-valuenow", String(Math.round(p.time)));
	}

	function summaryHTML(n, reveal) {
		// To-dos come in once most of the summary's words have arrived.
		const later = 3 + Math.min(Math.ceil(n.summary.split(/\s+/).length / 10), 6);
		let w = 0;
		const words = n.summary
			.split(/(\s+)/)
			.map((part) => (part.trim() ? `<span class="vn-word" style="--w:${Math.min(w++, 60)}">${esc(part)}</span>` : part))
			.join("");
		return `
			<div class="vn-copyrow" data-reveal style="--r:2">${copyBtn("summary", "Copy summary")}${copyBtn("full", "Copy with transcript")}</div>
			<p class="vn-summary">${reveal ? words : esc(n.summary)}</p>
			${
				n.actionItems.length
					? `<section class="vn-sec vn-rise" style="--i:1">
						<h2 class="vn-h" data-reveal style="--r:${later}">To do</h2>
						<ul class="vn-panel vn-todo" data-reveal style="--r:${later + 0.5}">${n.actionItems
							.map(
								(t, i) => `<li data-reveal style="--r:${later + 1 + i * 0.6}">
									<button type="button" class="vn-item press-soft${n.done[i] ? " done" : ""}" data-item="${i}" role="checkbox" aria-checked="${n.done[i]}"><span class="vn-box">${icon("check")}</span><span class="vn-item-text">${esc(t)}</span></button>
								</li>`,
							)
							.join("")}</ul>
					</section>`
					: ""
			}
			${
				n.questions.length
					? `<section class="vn-sec vn-rise" data-reveal style="--i:2;--r:${later + 1.5 + n.actionItems.length * 0.6}">
						<h2 class="vn-h">They asked</h2>
						<ul class="vn-asked">${n.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
					</section>`
					: ""
			}`;
	}

	function transcriptHTML(n) {
		const english = vn.txLang === "english" && !!n.english;
		const timed = n.timed && n.segments.length > 0;
		return `
			<div class="vn-tx-head">
				${
					n.english
						? `<div class="seg sm" data-txlang role="radiogroup" aria-label="Transcript language"><span class="seg-thumb" aria-hidden="true"></span>
							<button type="button" role="radio" class="press" data-lang-opt="original" aria-checked="${!english}">Original</button>
							<button type="button" role="radio" class="press" data-lang-opt="english" aria-checked="${english}">English</button></div>`
						: "<span></span>"
				}
				<div class="vn-tx-actions">
					${
						timed
							? copyBtn("srt", "Copy SRT")
							: `<button class="vn-copy press" type="button" data-add-timings title="Transcribe again with a time for each line">${icon("clock")}<span>Add timings</span></button>`
					}
					${copyBtn("tx", "Copy")}
				</div>
			</div>
			<div class="vn-swap" data-txbody>${txBody(n)}</div>`;
	}

	function txBody(n) {
		const english = vn.txLang === "english" && !!n.english;
		if (n.timed && n.segments.length)
			return `<ol class="vn-lines">${n.segments
				.map((s, i) => {
					const w = english ? s.english || s.text : s.text;
					return `<li class="vn-line vn-rise" data-line="${i}" style="--i:${Math.min(i, 12)}">
						<button type="button" class="vn-stamp press" data-seek-to="${s.start}" aria-label="Play from ${stamp(s.start)}">${stamp(s.start)}</button>
						<span dir="${dirOf(w)}">${esc(w)}</span>
					</li>`;
				})
				.join("")}</ol>`;
		return `<div class="vn-paras">${paragraphs(english ? n.english : n.transcript)
			.map((p, i) => `<p data-line="${i}" dir="${dirOf(p)}">${esc(p)}</p>`)
			.join("")}</div>`;
	}

	/** Lights the line being spoken and keeps it in view while the audio plays. */
	function paintLine() {
		const n = current();
		const view = liveView();
		const box = view && $(".vn-tab", view);
		if (!n || !box || vn.tab !== "transcript") return;
		const p = vn.pb && vn.pb.id === n.id ? vn.pb : null;
		const english = vn.txLang === "english" && !!n.english;
		const spans =
			n.timed && n.segments.length ? n.segments : estimateSpans(paragraphs(english ? n.english : n.transcript), n.duration);
		const i = p && (p.playing || p.time > 0) ? activeIndex(spans, p.time) : -1;
		let on = null;
		for (const el of $$("[data-line]", box)) {
			const hit = Number(el.dataset.line) === i;
			el.classList.toggle("on", hit);
			if (hit) {
				on = el;
				el.setAttribute("aria-current", "true");
			} else el.removeAttribute("aria-current");
		}
		if (!on || !p.playing || box._followed === i) return;
		box._followed = i;
		const top = on.offsetTop;
		if (top >= box.scrollTop + 8 && top + on.offsetHeight <= box.scrollTop + box.clientHeight - 24) return;
		box.scrollTo({ top: top - box.clientHeight / 2 + on.offsetHeight / 2, behavior: reduced ? "auto" : "smooth" });
	}

	// ── Chat (Chat.tsx) ───────────────────────────────────────────────────────

	const typingHTML = `<div class="vn-typing" aria-label="Antigravity is replying">${[0, 1, 2]
		.map((i) => `<i style="--i:${i}"></i>`)
		.join("")}</div>`;
	const mineHTML = (text, animate) => `<div class="vn-mine${animate ? " vn-send-in" : ""}"><p>${esc(text)}</p></div>`;
	const replyHTML = (text, i) =>
		`<div class="vn-reply"><div class="vn-prose">${markdown(text)}</div><div class="vn-reply-copy">${copyBtn(`reply:${i}`, "Copy")}</div></div>`;

	function chatHTML(n) {
		const empty = !n.chat.length && !n.pending;
		return `<div class="vn-chat">
			<div class="vn-msgs scroll-soft" data-msgs>
				${
					empty
						? `<p class="vn-hint vn-swap">Ask anything about this voice note, or start with one of the options below.</p>`
						: n.chat.map((m, i) => (m.role === "me" ? mineHTML(m.text, false) : replyHTML(m.text, i))).join("")
				}
				${n.pending ? typingHTML : ""}
			</div>
			<div class="vn-composer">
				<div class="vn-chips">${SHORTCUTS.map(
					(s) => `<button type="button" class="vn-chip press" data-chip="${esc(s)}"${n.pending ? " disabled" : ""}>${esc(s)}</button>`,
				).join("")}</div>
				<form class="vn-input" data-form>
					<textarea class="vn-field" data-field rows="1" placeholder="Message Antigravity" aria-label="Message Antigravity"></textarea>
					<button class="vn-send press" type="submit" aria-label="Send" disabled>${icon("send")}</button>
				</form>
			</div>
		</div>`;
	}

	function wireChat(pane, n) {
		const msgs = $("[data-msgs]", pane);
		const field = $("[data-field]", pane);
		const sendBtn = $(".vn-send", pane);
		const grow = () => {
			field.style.height = "auto";
			field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
			sendBtn.disabled = !field.value.trim() || n.pending;
		};
		const submit = () => {
			const v = field.value.trim();
			if (!v || n.pending) return;
			field.value = "";
			grow();
			ask(n, v);
		};
		field.addEventListener("input", grow);
		field.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
				e.preventDefault();
				submit();
			}
		});
		$("[data-form]", pane).addEventListener("submit", (e) => {
			e.preventDefault();
			submit();
		});
		pane.addEventListener("click", (e) => {
			const chip = e.target.closest("[data-chip]");
			if (chip && !chip.disabled) return void ask(n, chip.dataset.chip);
			const cp = e.target.closest("[data-copy]");
			if (cp) copyFeedback(cp, copySource(n, cp.dataset.copy));
		});
		msgs.scrollTop = msgs.scrollHeight;
	}

	function chatPane(n) {
		const v = liveView();
		return v && vn.page === "note" && vn.id === n.id && vn.tab === "chat" ? $("[data-pane]", v) : null;
	}

	function setChatBusy(pane, busy) {
		for (const c of $$("[data-chip]", pane)) c.disabled = busy;
		const f = $("[data-field]", pane);
		$(".vn-send", pane).disabled = busy || !f.value.trim();
	}

	async function ask(n, message) {
		if (n.pending) return;
		n.pending = true;
		n.chat.push({ role: "me", text: message });
		const pane = chatPane(n);
		if (pane) {
			const msgs = $("[data-msgs]", pane);
			$(".vn-hint", msgs)?.remove();
			msgs.insertAdjacentHTML("beforeend", mineHTML(message, !reduced) + typingHTML);
			setChatBusy(pane, true);
			msgs.scrollTo({ top: msgs.scrollHeight, behavior: reduced ? "auto" : "smooth" });
		}
		await sleep(reduced ? 200 : 900 + Math.random() * 500);
		const text = n.replies[message] || FALLBACK_REPLY;
		n.chat.push({ role: "agent", text });
		n.pending = false;
		const now = chatPane(n);
		if (!now) return;
		const msgs = $("[data-msgs]", now);
		$(".vn-typing", msgs)?.remove();
		msgs.insertAdjacentHTML("beforeend", replyHTML(text, n.chat.length - 1));
		const el = msgs.lastElementChild;
		const ms = reduced ? 0 : writeIn($(".vn-prose", el));
		const copy = $(".vn-reply-copy", el);
		copy.classList.add("vn-rise");
		copy.style.animationDelay = `${ms}ms`;
		setChatBusy(now, false);
		// A long reply is read from its first line, not its last.
		if (el.offsetHeight > msgs.clientHeight - 48) msgs.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
		else msgs.scrollTo({ top: msgs.scrollHeight, behavior: "smooth" });
	}

	// ── Transcribing ──────────────────────────────────────────────────────────

	function transcribe(n, timed) {
		if (isPending(n)) return;
		n.status = "queued";
		n.wantTimed = timed ?? vn.prefs.timed;
		vn.queue.push(n);
		changed(n);
		pump();
	}

	// One voice note at a time, like the app.
	async function pump() {
		if (vn.working || !vn.queue.length) return;
		const n = vn.queue.shift();
		vn.working = n;
		await sleep(reduced ? 100 : 600);
		if (vn.notes.includes(n)) {
			n.status = "processing";
			changed(n);
			await sleep(reduced ? 600 : 4800);
		}
		if (vn.notes.includes(n)) {
			n.status = "done";
			n.read = false;
			n.timed = n.wantTimed ?? true;
			finished(n);
		}
		vn.working = null;
		pump();
	}

	function changed(n) {
		buildTray();
		const view = liveView();
		if (!view) return;
		if (vn.page === "list") return void syncRows(view, true);
		if (vn.page !== "note" || vn.id !== n.id) return;
		setImmersive();
		renderActions();
		if (vn.scene) vn.scene.setActive(n.status === "processing");
		else {
			// A finished note being transcribed again.
			stopPlayback();
			view.classList.remove("vn-revealing");
			renderView(view);
		}
	}

	/** The scene implodes over the result, and the result builds in as the light comes back. */
	function finished(n) {
		buildTray();
		showDeskToast(n);
		const view = liveView();
		if (!view) return;
		if (vn.page === "list") return void syncRows(view, true);
		if (vn.page !== "note" || vn.id !== n.id) return;
		endScene();
		setImmersive();
		renderActions();
		view.classList.add("vn-revealing");
		renderView(view, true);
		const outro = document.createElement("div");
		outro.className = "vn-outro";
		const scene = createScene(n, true);
		outro.append(scene.el);
		view.append(outro);
		setTimeout(() => {
			scene.destroy();
			outro.remove();
		}, IMPLODE_S * 1000 + 60);
		setTimeout(() => {
			// Settle without replaying the entrances the reveal held back.
			for (const el of $$(".vn-rise, .vn-swap", view)) el.classList.remove("vn-rise", "vn-swap");
			view.classList.remove("vn-revealing");
		}, IMPLODE_S * 1000 + 2000);
	}

	async function download(row) {
		const sample = SAMPLES.find((s) => s.id === row.dataset.id);
		const btn = $(".dl-btn", row);
		if (!sample || btn.disabled) return;
		vn.started = true;
		btn.disabled = true;
		btn.textContent = "Downloading";
		row.classList.add("loading");
		await sleep(reduced ? 100 : 750);
		btn.textContent = "Downloaded";

		// The app moves it in from Downloads and opens the window on it.
		const note = makeNote(sample, "queued");
		note.wantTimed = vn.prefs.timed;
		vn.notes.unshift(note);
		vn.queue.push(note);
		const win = $("#vn");
		win.style.display = "";
		win.classList.remove("bump");
		void win.offsetWidth;
		win.classList.add("bump");
		go("note", note.id);
		buildTray();
		pump();
	}

	let deskToastTimer;
	function showDeskToast(n) {
		const t = $("#desk-toast");
		$("#dt-body").textContent = n.summary;
		t.classList.add("show");
		clearTimeout(deskToastTimer);
		deskToastTimer = setTimeout(() => t.classList.remove("show"), 4200);
	}

	// ── The listening scene (Listening.tsx) ───────────────────────────────────
	// The window goes dark. A dark orb sits inside a thin ring of light, with the
	// note's waveform around it and a live sound wave running through it. Grains
	// spiral in on a tilted disc and now and then a character drifts out. When
	// the result arrives everything is drawn into the orb, it collapses to a
	// point of light, and the point blooms as the light comes back up.

	const GLYPHS = [
		..."abcdefghijklmnopqrstuvwxyz",
		..."ابتجدرسعفقلمنهوي",
		..."αβγδλμπσω",
		..."бгджзклмнпрст",
		..."कगजतदनपमरस",
		..."あいうえおかきくけこ",
	];
	const NOISE = "abcdefghijklmnopqrstuvwxyz";
	const TILT = 0.34;
	const BARS = 72;
	const GRAINS = 110;
	const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
	const easeOutBack = (x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
	const easeOut = (x) => 1 - (1 - x) ** 3;
	const easeIn = (x) => x ** 3;

	function ringShape(id, count) {
		let h = 2166136261;
		for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
		return Array.from({ length: count }, (_, i) => {
			h = Math.imul(h ^ (i + 1), 2246822507) >>> 0;
			const r = (h % 1000) / 1000;
			const envelope = Math.sin((Math.PI * (i + 0.5)) / count) * 0.5 + 0.5;
			return 0.15 + r * 0.85 * envelope;
		});
	}

	/** A word that types itself out of scrambled letters. Returns its timer. */
	function decode(p, text) {
		p.setAttribute("aria-label", text);
		const paint = (shown, noise) => {
			p.innerHTML = `<span aria-hidden="true">${esc(text.slice(0, shown))}</span><span aria-hidden="true" class="scene-noise">${esc(
				noise,
			)}</span><span aria-hidden="true" class="scene-hold">${esc(text.slice(shown + noise.length))}</span>`;
		};
		if (reduced) {
			paint(text.length, "");
			return 0;
		}
		paint(0, "");
		let n = 0;
		const timer = setInterval(() => {
			n += 1;
			const done = Math.max(0, n - 3);
			let s = "";
			for (let i = done; i < Math.min(text.length, n); i++) s += text[i] === " " ? " " : NOISE[(Math.random() * NOISE.length) | 0];
			paint(Math.min(text.length, done), s);
			if (done >= text.length) clearInterval(timer);
		}, 45);
		return timer;
	}

	function endScene() {
		vn.scene?.destroy();
		vn.scene = null;
	}

	function createScene(note, leaving) {
		const el = document.createElement("div");
		el.className = `scene ${leaving ? "scene-leaving" : "scene-in"}`;
		el.innerHTML = `<div class="scene-glow" aria-hidden="true"></div><canvas aria-hidden="true"></canvas>
			<div class="scene-copy${leaving ? " gone" : ""}"><div class="scene-slot"></div></div>`;
		const canvas = $("canvas", el);
		const copy = $(".scene-copy", el);
		const slot = $(".scene-slot", el);
		const glow = $(".scene-glow", el);
		const ctx = canvas.getContext("2d");
		const still = reduced;
		// The bloom only lights a light page; in dark mode the point just fades.
		const peak = isDark() ? 0 : 0.92;
		const half = ringShape(note.id, BARS / 2);
		const env = ringShape(`${note.id}:env`, 64);
		let active = leaving || note.status === "processing";

		let label = null;
		let decodeTimer = 0;
		const setLabel = () => {
			clearInterval(decodeTimer);
			label?.remove();
			label = document.createElement("p");
			label.className = "scene-label";
			copy.append(label);
			decodeTimer = decode(label, active ? "Listening" : "Waiting its turn");
		};
		glow.classList.toggle("dim", !active);
		if (!leaving) setLabel();

		let W = 0;
		let H = 0;
		let cx = 0;
		let cy = 0;
		let R = 60;
		let maxR = 300;
		const grains = [];
		const glyphs = [];
		const ripples = [];
		let level = 0.4;
		let energy = active ? 1 : 0.3;
		let lastRipple = 0;
		let spawnDebt = 0;

		const newGrain = (anywhere) => {
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

		// Layout sizes, not screen rects: the desk around the window is scaled.
		const resize = () => {
			const w = canvas.offsetWidth;
			const h = canvas.offsetHeight;
			if (!w || !h) return;
			const dpr = window.devicePixelRatio || 1;
			W = w;
			H = h;
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			cx = copy.offsetLeft + slot.offsetLeft + slot.offsetWidth / 2;
			cy = copy.offsetTop + slot.offsetTop + slot.offsetHeight / 2;
			R = clamp(Math.min(slot.offsetWidth, slot.offsetHeight) * 0.21, 40, 80);
			maxR = Math.hypot(W, H) * 0.55;
			if (!grains.length) for (let i = 0; i < GRAINS; i++) grains.push(newGrain(true));
		};
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);
		ro.observe(slot);

		const t0 = performance.now();
		let last = t0;
		let raf = 0;

		const frame = (now) => {
			if (!W || (!deskOnScreen && !leaving)) {
				last = now;
				raf = requestAnimationFrame(frame);
				return;
			}
			const dt = clamp((now - last) / 1000, 0, 0.05);
			last = Math.max(last, now);
			const t = Math.max(0, (now - t0) / 1000);
			const intro = leaving || still ? 1 : easeOutBack(clamp(t / 1.2));
			const fadeIn = leaving || still ? 1 : clamp(t / 1.6);
			const end = leaving ? clamp(t / IMPLODE_S) : 0;
			const pull = leaving ? clamp(end / 0.5) : 0;
			const bloom = leaving ? clamp((end - 0.5) / 0.5) : 0;
			const shrink = !leaving
				? 1
				: pull < 0.16
					? 1 + 0.08 * easeOut(pull / 0.16)
					: 1.08 * (1 - easeIn((pull - 0.16) / 0.84));
			energy += ((active ? 1 : 0.3) - energy) * Math.min(1, dt * 2.5);

			// A speech-like envelope: syllables from the note's shape.
			const syll = env[Math.floor(t * 7) % env.length];
			const target = still ? 0.5 : syll ** 1.3 * (0.7 + 0.3 * Math.abs(Math.sin(t * 8.3) * Math.sin(t * 3.1)));
			level += (target * energy - level) * Math.min(1, dt * 7);

			ctx.clearRect(0, 0, W, H);
			ctx.globalCompositeOperation = "lighter";
			ctx.lineCap = "round";

			const Rc = R * 0.8 * intro * (1 + 0.04 * level) * shrink;
			const hasOrb = Rc > 0.6;

			// Ripples: plain circles, every couple of seconds.
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

			// Disc of grains, spiralling in.
			for (const g of grains) {
				const near = Math.min((R * 2) / g.rho, 10);
				if (leaving) {
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
			const drawGrains = (front) => {
				const groups = new Map();
				for (const g of grains) {
					const s = Math.sin(g.phi);
					if (s >= 0 !== front) continue;
					const depth = 0.35 + 0.65 * (s * 0.5 + 0.5);
					const nearO = clamp((g.rho - Math.max(Rc, 1) * 0.86) / (R * 0.4));
					const far = clamp((maxR - g.rho) / (maxR * 0.3));
					const a =
						clamp(g.age) * nearO * far * depth * (0.3 + 0.7 * energy) * fadeIn * (1 + pull * 0.6) * (1 - bloom);
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

				// A sound wave runs through the dark: one bright line, two fainter echoes.
				ctx.save();
				ctx.beginPath();
				ctx.arc(cx, cy, Rc * 0.94, 0, Math.PI * 2);
				ctx.clip();
				ctx.globalCompositeOperation = "lighter";
				const span = Rc * 0.8;
				const amp = Rc * 0.44 * (0.3 + 0.7 * level) * (0.35 + 0.65 * energy) * fadeIn;
				const tw = still ? 0.8 : t;
				const lines = [
					{ hue: 300, alpha: 0.5, width: 1.1, scale: 0.78, speed: 3.1, offset: 2.3 },
					{ hue: 228, alpha: 0.55, width: 1.1, scale: 0.62, speed: 1.9, offset: 4.1 },
					{ hue: 280, alpha: 0.95, width: 1.8, scale: 1, speed: 2.5, offset: 0 },
				];
				lines.forEach((ln, k) => {
					const wave = new Path2D();
					const ph = tw * ln.speed + ln.offset;
					for (let i = 0; i <= 64; i++) {
						const u = i / 64;
						const taper = Math.sin(Math.PI * u) ** 2;
						const y = Math.sin(u * 14 + ph) * 0.55 + Math.sin(u * 23 - ph * 1.4) * 0.22 + Math.sin(u * 6 + ph * 0.7) * 0.38;
						const x = cx - span + u * span * 2;
						if (i) wave.lineTo(x, cy + amp * taper * y * ln.scale);
						else wave.moveTo(x, cy);
					}
					if (k === lines.length - 1) {
						ctx.lineWidth = 6;
						ctx.strokeStyle = `hsla(272,100%,70%,${0.22 * fadeIn})`;
						ctx.stroke(wave);
					}
					ctx.lineWidth = ln.width;
					ctx.strokeStyle = `hsla(${ln.hue},100%,${k === lines.length - 1 ? 92 : 74}%,${ln.alpha * fadeIn})`;
					ctx.stroke(wave);
				});
				ctx.restore();
			}

			// The ring of light, brighter on the side turning toward you.
			if (hasOrb) {
				ctx.globalCompositeOperation = "lighter";
				const spin = still ? 0.6 : t * 1.2;
				const conic = typeof ctx.createConicGradient === "function" ? ctx.createConicGradient(spin, cx, cy) : null;
				if (conic) {
					conic.addColorStop(0, "hsla(280,100%,96%,1)");
					conic.addColorStop(0.5, "hsla(258,90%,62%,0.35)");
					conic.addColorStop(1, "hsla(280,100%,96%,1)");
				}
				for (const [w, alpha] of [
					[6 * (1 + pull), 0.14 * (1 + pull)],
					[1.4 * (1 + pull * 0.8), 1],
				]) {
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

			// A few characters drift out and settle.
			if (!still && active && !leaving) {
				spawnDebt += dt * (1.5 + 4 * level) * fadeIn;
				while (spawnDebt >= 1) {
					spawnDebt -= 1;
					glyphs.push({
						a: Math.random() * Math.PI * 2,
						r: Rc + 14,
						vr: 18 + Math.random() * 26,
						ch: GLYPHS[(Math.random() * GLYPHS.length) | 0],
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
					g.ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
					g.swap = 0.06 + Math.random() * 0.08;
				}
				const a = clamp(g.age / 0.4) * (1 - travel) ** 1.6 * fadeIn * 0.6;
				ctx.font = `400 ${g.size}px "Geist Mono", ui-monospace, monospace`;
				ctx.fillStyle = settled ? `hsla(270,60%,94%,${a})` : `hsla(268,100%,78%,${a})`;
				ctx.fillText(g.ch, cx + Math.cos(g.a) * g.r, cy + Math.sin(g.a) * g.r * 0.92);
			}

			// The point of light, then the bloom that brings the light back.
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
				if (bloom > 0 && peak > 0) {
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

		return {
			el,
			setActive(v) {
				if (v === active) return;
				active = v;
				glow.classList.toggle("dim", !active);
				setLabel();
			},
			destroy() {
				cancelAnimationFrame(raf);
				ro.disconnect();
				clearInterval(decodeTimer);
			},
		};
	}

	// ── Delete, and the window's own toast ────────────────────────────────────

	function openConfirm() {
		if (vn.page !== "note" || $(".vn-confirm")) return;
		const body = $("#vn-body");
		body.insertAdjacentHTML(
			"beforeend",
			`<div class="vn-confirm">
				<button class="vn-confirm-bg" type="button" aria-label="Cancel" data-cancel></button>
				<div class="vn-sheet vn-panel" role="dialog" aria-label="Delete voice note">
					<p class="vn-sheet-t">Delete this voice note?</p>
					<p class="vn-sheet-d">The audio file goes to the Trash. The transcript, summary and chat are deleted.</p>
					<div class="vn-sheet-actions">
						<button class="vn-btn press" type="button" data-cancel>Cancel</button>
						<button class="vn-btn danger press" type="button" data-delete>${icon("trash")}<span>Delete</span></button>
					</div>
				</div>
			</div>`,
		);
		const box = $(".vn-confirm", body);
		box.addEventListener("click", async (e) => {
			if (e.target.closest("[data-cancel]")) return closeConfirm();
			const del = e.target.closest("[data-delete]");
			if (!del || del.disabled) return;
			del.disabled = true;
			$("[data-icon]", del).outerHTML = spinner(14);
			await sleep(reduced ? 0 : 350);
			deleteNote(current());
		});
		$(".vn-sheet [data-cancel]", box).focus({ preventScroll: true });
	}

	function closeConfirm() {
		$(".vn-confirm")?.remove();
	}

	function deleteNote(n) {
		if (!n) return;
		vn.notes = vn.notes.filter((x) => x !== n);
		vn.queue = vn.queue.filter((x) => x !== n);
		// A deleted sample can be downloaded again.
		const row = $(`#downloads .dl-row[data-id="${n.id}"]`);
		if (row) {
			row.classList.remove("loading");
			const btn = $(".dl-btn", row);
			btn.disabled = false;
			btn.textContent = "Download";
		}
		go("list");
		windowToast("Voice note deleted. The audio is in the Trash.", "check");
		buildTray();
	}

	let winToastTimer;
	function windowToast(text, name) {
		const slot = $(".vn-toast-slot");
		slot.innerHTML = `<div class="vn-toast" role="status">${name ? icon(name) : ""}<span>${esc(text)}</span></div>`;
		clearTimeout(winToastTimer);
		winToastTimer = setTimeout(() => (slot.innerHTML = ""), 2400);
	}

	// ── Settings (Settings.tsx) ───────────────────────────────────────────────

	const switchHTML = (key, on, label) =>
		`<button type="button" role="switch" class="vn-switch press" data-switch="${key}" aria-checked="${on}" aria-label="${label}"><span></span></button>`;

	function settingsView(view) {
		const p = vn.prefs;
		view.innerHTML = `
			<div class="vn-scroll scroll-soft vn-settings">
				<section class="vn-set vn-rise" style="--i:0">
					<h2 class="vn-h">Picking up voice notes</h2>
					<div class="vn-panel vn-set-rows">
						<div class="vn-set-row"><span>Watch folder</span><div class="vn-set-c"><span class="vn-set-v">Downloads</span><button class="vn-btn press" type="button" data-folder>Change</button></div></div>
						<div class="vn-pattern">
							<label for="vn-pattern">File names to watch for</label>
							<input id="vn-pattern" data-pattern spellcheck="false" autocomplete="off" autocapitalize="off" />
							<div class="vn-pattern-note" data-pattern-note aria-live="polite"></div>
							<div data-pattern-actions></div>
						</div>
					</div>
				</section>
				<section class="vn-set vn-rise" style="--i:1">
					<h2 class="vn-h">Transcription</h2>
					<div class="vn-panel vn-set-rows">
						<div class="vn-set-row"><span>Model</span><label class="vn-select"><span class="sr-only">Model</span><select data-model>${MODELS.map(
							(m) => `<option value="${m.id}"${m.id === p.model ? " selected" : ""}>${m.label}</option>`,
						).join("")}</select>${icon("chevron")}</label></div>
						<div class="vn-set-row"><span>Reasoning</span><div class="seg sm" data-effort role="radiogroup" aria-label="Reasoning level"><span class="seg-thumb" aria-hidden="true"></span>${[
							"low",
							"medium",
							"high",
						]
							.map((e) => `<button type="button" role="radio" class="press" data-effort-opt="${e}" aria-checked="${p.effort === e}">${EFFORT_LABEL[e]}</button>`)
							.join("")}</div></div>
						<div class="vn-set-row"><span>Timed transcript</span>${switchHTML("timed", p.timed, "Timed transcript")}</div>
					</div>
				</section>
				<div class="vn-set-help vn-rise" style="--i:1">
					<p>Low reasoning is the fastest and is enough for most voice notes. Medium and high take two to three times longer.</p>
					<p>A timed transcript gives each line the time it was said, like subtitles. Tap a line to play from there, or copy it as an SRT file.</p>
					<p>Changes apply to the next voice note. Reasoning also applies to chat replies.</p>
				</div>
				<section class="vn-set vn-rise" style="--i:2">
					<h2 class="vn-h">Keeping voice notes</h2>
					<div class="vn-panel vn-set-rows">
						<div class="vn-set-row"><span>Delete old voice notes</span>${switchHTML("keep", p.keep, "Delete old voice notes")}</div>
						<div class="vn-collapse${p.keep ? " open" : ""}" data-after><div><div class="vn-set-row"><span>After</span><div class="vn-stepper">
							<button type="button" class="press" data-step="-1" aria-label="One day fewer" title="One day fewer">${icon("minus")}</button>
							<span class="vn-days" data-days>${daysLabel(p.days)}</span>
							<button type="button" class="press" data-step="1" aria-label="One day more" title="One day more">${icon("plus")}</button>
						</div></div></div></div>
						<div class="vn-set-row"><span>Voice notes folder</span><button class="vn-btn press" type="button" data-finder>${icon("folder")}<span>Show in Finder</span></button></div>
					</div>
				</section>
				<div class="vn-set-help vn-rise" style="--i:2" data-keep-help></div>
			</div>`;

		const save = (patch) => {
			Object.assign(vn.prefs, patch);
			// The app confirms each change in the title bar.
			if (vn.page === "settings") $(".vn-actions").innerHTML = `<span class="vn-saved" aria-live="polite">${icon("check")}Saved</span>`;
		};
		const keepHelp = () => {
			$("[data-keep-help]", view).innerHTML = vn.prefs.keep
				? `<p>A voice note is deleted ${daysLabel(vn.prefs.days)} after it arrives, with its transcript and chat. The audio goes to the Trash.</p>`
				: "<p>Voice notes stay until you delete them.</p>";
			$('[data-step="-1"]', view).disabled = vn.prefs.days <= 1;
			$('[data-step="1"]', view).disabled = vn.prefs.days >= 365;
		};
		keepHelp();

		$("[data-folder]", view).addEventListener("click", () => windowToast("In the app, this opens a folder picker."));
		$("[data-finder]", view).addEventListener("click", () => windowToast("In the app, this opens the folder in Finder."));
		$("[data-model]", view).addEventListener("change", (e) => save({ model: e.target.value }));
		const effort = $("[data-effort]", view);
		requestAnimationFrame(() => layoutSeg(effort, false));
		effort.addEventListener("click", (e) => {
			const b = e.target.closest("[data-effort-opt]");
			if (!b || vn.prefs.effort === b.dataset.effortOpt) return;
			segValue(effort, "effortOpt", b.dataset.effortOpt);
			save({ effort: b.dataset.effortOpt });
		});
		for (const sw of $$("[data-switch]", view))
			sw.addEventListener("click", () => {
				const on = sw.getAttribute("aria-checked") !== "true";
				sw.setAttribute("aria-checked", String(on));
				save({ [sw.dataset.switch]: on });
				if (sw.dataset.switch === "keep") {
					$("[data-after]", view).classList.toggle("open", on);
					keepHelp();
				}
			});
		for (const b of $$("[data-step]", view))
			b.addEventListener("click", () => {
				const days = Math.max(1, Math.min(365, vn.prefs.days + Number(b.dataset.step)));
				if (days === vn.prefs.days) return;
				save({ days });
				const label = $("[data-days]", view);
				const next = document.createElement("span");
				next.className = "vn-days vn-swap";
				next.dataset.days = "";
				next.textContent = daysLabel(days);
				label.replaceWith(next);
				keepHelp();
			});
		wirePattern(view, save);
	}

	/** The file name pattern, checked live against the watched folder as you type. */
	function wirePattern(view, save) {
		const input = $("[data-pattern]", view);
		const note = $("[data-pattern-note]", view);
		const actions = $("[data-pattern-actions]", view);
		let timer = 0;
		let error = null;
		input.value = vn.prefs.pattern;

		const test = (src) => {
			if (!src.trim()) return "Enter a pattern.";
			try {
				new RegExp(src, "i");
				return null;
			} catch (e) {
				return e.message.replace(/^Invalid regular expression: /, "");
			}
		};
		const paintActions = () => {
			const dirty = input.value !== vn.prefs.pattern;
			actions.innerHTML = dirty
				? `<div class="vn-pattern-actions vn-rise"><button class="vn-btn accent press" type="button" data-save${error ? " disabled" : ""}>Save pattern</button><button class="vn-btn press" type="button" data-revert>Cancel</button></div>`
				: vn.prefs.pattern !== DEFAULT_PATTERN
					? `<button class="vn-link press" type="button" data-default>Use the WhatsApp pattern</button>`
					: "";
		};
		const check = () => {
			clearTimeout(timer);
			note.innerHTML = `<span class="vn-checking">${spinner(11)} Checking Downloads</span>`;
			timer = setTimeout(
				() => {
					error = test(input.value);
					input.setAttribute("aria-invalid", String(!!error));
					// WhatsApp audio is moved out of Downloads as it arrives, so none waits there.
					note.innerHTML = error
						? `<span class="vn-danger">Not a valid pattern: ${esc(error)}</span>`
						: "<span>No audio files in Downloads match right now.</span>";
					paintActions();
				},
				reduced ? 0 : 180,
			);
			paintActions();
		};
		const commit = () => {
			if (input.value === vn.prefs.pattern || error) return;
			save({ pattern: input.value });
			paintActions();
		};
		input.addEventListener("input", check);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") commit();
			if (e.key === "Escape" && input.value !== vn.prefs.pattern) {
				e.stopPropagation();
				input.value = vn.prefs.pattern;
				check();
			}
		});
		actions.addEventListener("click", (e) => {
			if (e.target.closest("[data-save]")) commit();
			else if (e.target.closest("[data-revert]")) {
				input.value = vn.prefs.pattern;
				check();
			} else if (e.target.closest("[data-default]")) {
				input.value = DEFAULT_PATTERN;
				check();
			}
		});
		check();
	}

	// ── Menu bar ──────────────────────────────────────────────────────────────

	function buildTray() {
		const menu = $("#tray-menu");
		const pending = vn.notes.filter(isPending).length;
		const checking = vn.update === "checking";
		menu.innerHTML = `
			${pending ? `<div class="tm-item dim">Transcribing ${pending} voice note${pending > 1 ? "s" : ""}</div><div class="tm-sep"></div>` : ""}
			<button class="tm-item" role="menuitem" data-tm="show"><span class="tm-check"></span>Show Voice Notes</button>
			<button class="tm-item" role="menuitemcheckbox" aria-checked="${vn.pinned}" data-tm="pin"><span class="tm-check">${vn.pinned ? "✓" : ""}</span>Keep on top</button>
			<div class="tm-sep"></div>
			<button class="tm-item${checking ? " dim" : ""}" role="menuitem" data-tm="update"${checking ? " disabled" : ""}><span class="tm-check"></span>${
				checking ? "Checking for updates…" : "Check for updates"
			}</button>
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
			checkUpdates();
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

	// Section titles come in word by word. Each word becomes an inline-block
	// span and the spaces stay plain text, so titles still wrap and balance.
	// The heading keeps its full text as its accessible name.
	function splitTitles() {
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		for (const h of $$(".h2.reveal")) {
			let n = 0;
			h.setAttribute("aria-label", h.textContent.trim().replace(/\s+/g, " "));
			const walk = (node) => {
				for (const child of [...node.childNodes]) {
					if (child.nodeType === Node.ELEMENT_NODE) {
						walk(child);
						continue;
					}
					if (child.nodeType !== Node.TEXT_NODE) continue;
					const frag = document.createDocumentFragment();
					for (const part of child.textContent.split(/(\s+)/)) {
						if (!part) continue;
						if (/^\s+$/.test(part)) {
							frag.append(part);
							continue;
						}
						const w = document.createElement("span");
						w.className = "w";
						w.setAttribute("aria-hidden", "true");
						w.style.setProperty("--w", String(n++));
						w.textContent = part;
						frag.append(w);
					}
					child.replaceWith(frag);
				}
			};
			walk(h);
			h.classList.add("split");
		}
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
			appVersion = data.tag.replace(/^v/, "");
			refreshFoot();
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
		splitTitles();
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
