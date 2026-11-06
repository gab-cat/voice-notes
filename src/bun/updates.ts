// Auto-update via Electrobun's Updater against GitHub Releases
// (release.baseUrl in electrobun.config.ts). Same flow as Focus Timer:
// check shortly after launch and hourly, download in the background,
// then offer "Restart to update".

import { Updater } from "electrobun/bun";
import type { AppInfo, UpdatePhase } from "../shared/types";

const CHECK_EVERY_MS = 60 * 60 * 1000;

export const appInfo: AppInfo = {
	version: "",
	channel: "",
	updatePhase: "idle",
	updateProgress: null,
	availableVersion: null,
	updateReady: false,
	error: null,
};

let onChange: (info: AppInfo) => void = () => {};

function set(phase: UpdatePhase, extra?: Partial<AppInfo>) {
	appInfo.updatePhase = phase;
	if (extra) Object.assign(appInfo, extra);
	onChange({ ...appInfo });
}

let inFlight: Promise<void> | null = null;

export async function checkForUpdate(): Promise<void> {
	if (inFlight) return inFlight;
	if (appInfo.channel === "dev" || appInfo.updateReady) return;
	inFlight = (async () => {
		set("checking", { error: null });
		try {
			const check = await Updater.checkForUpdate();
			if (check.error) return set("error", { error: check.error });
			appInfo.availableVersion = check.version || null;
			if (!check.updateAvailable) return set("idle");
			set("downloading", { updateProgress: 0 });
			await Updater.downloadUpdate();
			const after = Updater.updateInfo();
			if (after?.updateReady) set("ready", { updateReady: true, updateProgress: 100 });
			else set("error", { error: after?.error || "The update didn't finish downloading." });
		} catch (err) {
			set("error", { error: (err as Error).message });
		}
	})();
	try {
		await inFlight;
	} finally {
		inFlight = null;
	}
}

export async function applyUpdate() {
	if (appInfo.updateReady) await Updater.applyUpdate();
}

export async function startUpdates(listener: (info: AppInfo) => void) {
	onChange = listener;
	try {
		appInfo.version = await Updater.localInfo.version();
		appInfo.channel = await Updater.localInfo.channel();
	} catch (err) {
		console.error("Couldn't read app version:", err);
	}
	Updater.onStatusChange((entry) => {
		if (entry.status === "download-progress" && entry.details?.progress != null) {
			appInfo.updateProgress = entry.details.progress;
			onChange({ ...appInfo });
		}
	});
	onChange({ ...appInfo });
	if (appInfo.channel === "dev") return;
	setTimeout(() => void checkForUpdate(), 5_000);
	setInterval(() => void checkForUpdate(), CHECK_EVERY_MS);
}
