// Renders assets/logo.svg into icon.iconset (the macOS app icon Electrobun
// picks up by default). Same approach as Focus Timer.
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dir, "..");
const svg = await readFile(join(ROOT, "assets", "logo.svg"));
const ICONSET_DIR = join(ROOT, "icon.iconset");

const SIZES = [
	{ name: "icon_16x16.png", px: 16 },
	{ name: "icon_16x16@2x.png", px: 32 },
	{ name: "icon_32x32.png", px: 32 },
	{ name: "icon_32x32@2x.png", px: 64 },
	{ name: "icon_128x128.png", px: 128 },
	{ name: "icon_128x128@2x.png", px: 256 },
	{ name: "icon_256x256.png", px: 256 },
	{ name: "icon_256x256@2x.png", px: 512 },
	{ name: "icon_512x512.png", px: 512 },
	{ name: "icon_512x512@2x.png", px: 1024 },
];

await rm(ICONSET_DIR, { recursive: true, force: true });
await mkdir(ICONSET_DIR, { recursive: true });
for (const { name, px } of SIZES) {
	await sharp(svg, { density: 384 }).resize(px, px).png({ compressionLevel: 9 }).toFile(join(ICONSET_DIR, name));
}
console.log(`Iconset written to ${ICONSET_DIR}`);
