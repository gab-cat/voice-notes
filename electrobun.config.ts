import type { ElectrobunConfig } from "electrobun";
import pkg from "./package.json" with { type: "json" };

export default {
	app: {
		name: "Voice Notes",
		identifier: "com.gab.voicenotes",
		version: pkg.version,
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
