import type { ElectrobunConfig } from "electrobun";
import pkg from "./package.json" with { type: "json" };

export default {
	app: {
		name: "Voice Notes",
		identifier: "com.gab.voicenotes",
		version: pkg.version,
	},
	release: {
		// Each GitHub Release must include stable-macos-arm64-update.json and
		// stable-macos-arm64-VoiceNotes.app.tar.zst (plus .patch files when present).
		// `/latest/download/<asset>` redirects to the newest release's asset.
		baseUrl: "https://github.com/gab-cat/voice-notes/releases/latest/download",
	},
	scripts: {
		// Ad-hoc signs the DMG's app so Gatekeeper says "unidentified developer"
		// instead of "damaged".
		postWrap: "scripts/post-wrap-sign.ts",
	},
	runtime: {
		// Closing the window keeps the app running in the menu bar, so it can
		// still pick up new voice notes.
		exitOnLastWindowClosed: false,
	},
	build: {
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			"dist/tray-icon.png": "views/mainview/tray-icon.png",
		},
		watchIgnore: ["dist/**"],
		mac: { bundleCEF: false },
		linux: { bundleCEF: false },
		win: { bundleCEF: false },
	},
} satisfies ElectrobunConfig;
