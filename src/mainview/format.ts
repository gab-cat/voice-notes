export function dayLabel(iso: string) {
	const d = new Date(iso);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const day = new Date(d);
	day.setHours(0, 0, 0, 0);
	const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
	if (diff === 0) return "Today";
	if (diff === 1) return "Yesterday";
	if (diff < 7) return d.toLocaleDateString([], { weekday: "long" });
	return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export const timeLabel = (iso: string) =>
	new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const whenLabel = (iso: string) => `${dayLabel(iso)}, ${timeLabel(iso)}`;

/** Plain-text version of a note for pasting elsewhere. */
export function noteAsText(
	note: {
		received: string;
		duration: number | null;
		summary: string;
		actionItems: { text: string; done: boolean }[];
		questions: string[];
		transcript: string;
		english: string;
	},
	withTranscript: boolean,
) {
	// Absolute date: "Today" goes stale once pasted somewhere.
	const date = new Date(note.received).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
	const parts = [
		`Voice note, ${date}, ${timeLabel(note.received)} (${clock(note.duration)})`,
		`Summary\n${note.summary}`,
	];
	if (note.actionItems.length)
		parts.push(`To do\n${note.actionItems.map((i) => `- [${i.done ? "x" : " "}] ${i.text}`).join("\n")}`);
	if (note.questions.length) parts.push(`They asked\n${note.questions.map((q) => `- ${q}`).join("\n")}`);
	if (withTranscript) {
		parts.push(`Transcript\n${note.transcript}`);
		if (note.english) parts.push(`English translation\n${note.english}`);
	}
	return parts.join("\n\n");
}

export function clock(s: number | null | undefined) {
	if (s == null || !Number.isFinite(s)) return "0:00";
	const t = Math.max(0, Math.round(s));
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

// Right-to-left only when RTL letters (Arabic, Hebrew, Urdu...) outnumber Latin ones,
// so a mostly-English paragraph that opens with "مرحبا" still reads left to right.
export function dirOf(text: string): "rtl" | "ltr" {
	const rtl = (text.match(/[֐-ࣿיִ-﷿ﹰ-﻿]/g) || []).length;
	const ltr = (text.match(/[A-Za-zÀ-ɏ]/g) || []).length;
	return rtl > ltr ? "rtl" : "ltr";
}

export const paragraphs = (text: string) =>
	text
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);

const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Small, escape-first markdown for chat replies. */
export function markdown(src: string) {
	const blocks: string[] = [];
	const text = esc(src).replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, code: string) => {
		blocks.push(code);
		return `\u0000${blocks.length - 1}\u0000`;
	});
	const inline = (s: string) =>
		s
			.replace(/`([^`]+)`/g, "<code>$1</code>")
			.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
			.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
	return text
		.split(/\n{2,}/)
		.map((para) => {
			const lines = para.split("\n");
			const t = para.trim();
			if (/^\u0000\d+\u0000$/.test(t)) return `<pre><code>${blocks[Number(t.slice(1, -1))]}</code></pre>`;
			if (lines.every((l) => /^\s*[-*•]\s+/.test(l)))
				return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
			if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
				return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
			return `<p>${inline(para.replace(/^#+\s*/gm, "")).replace(/\n/g, "<br>")}</p>`;
		})
		.join("")
		.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<pre><code>${blocks[Number(i)]}</code></pre>`);
}
