// Renders the menu bar icon: a small waveform, drawn black on transparent so
// macOS can tint it as a template image. Output: src/mainview/public/tray-icon.png
import sharp from "sharp";
import { join } from "node:path";

const bars = [5, 10, 16, 10, 13, 7, 4]; // heights on an 18pt grid
const w = 18;
const gap = 2.4;
const barW = 1.6;
const x0 = (w - (bars.length * barW + (bars.length - 1) * (gap - barW))) / 2;

const rects = bars
	.map((h, i) => {
		const x = x0 + i * gap;
		const y = (w - h) / 2;
		return `<rect x="${x.toFixed(2)}" y="${y}" width="${barW}" height="${h}" rx="${barW / 2}" fill="#000"/>`;
	})
	.join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 ${w} ${w}">${rects}</svg>`;
const out = join(import.meta.dir, "..", "src", "mainview", "public", "tray-icon.png");
await sharp(Buffer.from(svg), { density: 72 * 2 }).resize(36, 36).png().toFile(out);
console.log(`Wrote ${out}`);
