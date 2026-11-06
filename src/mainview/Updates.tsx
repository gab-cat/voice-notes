import { useState } from "react";
import type { AppInfo } from "../shared/types";
import { applyUpdate, checkForUpdate } from "./rpc";
import { Button, Spinner } from "./ui";

/** Shown at the top of the list once a downloaded update is ready. */
export function UpdateBanner({ info }: { info: AppInfo }) {
	const [restarting, setRestarting] = useState(false);
	if (!info.updateReady) return null;
	return (
		<div className="panel animate-rise mx-4 mb-3 flex items-center justify-between gap-3 p-3">
			<p className="text-[12.5px] leading-[1.45]">
				{info.availableVersion ? `Version ${info.availableVersion} is ready.` : "An update is ready."}
			</p>
			<Button
				tone="accent"
				busy={restarting}
				onClick={async () => {
					setRestarting(true);
					await applyUpdate().catch(() => setRestarting(false));
				}}
			>
				Restart to update
			</Button>
		</div>
	);
}

/** Version line with a manual check, at the bottom of the list. */
export function VersionFooter({ info }: { info: AppInfo }) {
	const [checked, setChecked] = useState(false);
	if (!info.version) return null;
	const busy = info.updatePhase === "checking" || info.updatePhase === "downloading";
	const dev = info.channel === "dev";

	let action: string;
	if (info.updatePhase === "checking") action = "Checking…";
	else if (info.updatePhase === "downloading")
		action = `Downloading${info.updateProgress != null ? ` ${Math.round(info.updateProgress)}%` : "…"}`;
	else if (info.updatePhase === "error") action = "Update failed, try again";
	else if (info.updateReady) action = "Update ready";
	else if (checked) action = "Up to date";
	else action = "Check for updates";

	return (
		<div className="mt-4 flex items-center justify-center gap-2 px-4 text-[11.5px]">
			<span className="tabular text-ink-3">
				Voice Notes {info.version}
				{dev ? " (dev)" : ""}
			</span>
			{dev ? null : (
				<>
					<span className="text-ink-3">·</span>
					<button
						disabled={busy || info.updateReady}
						title={info.updatePhase === "error" ? (info.error ?? undefined) : undefined}
						onClick={async () => {
							await checkForUpdate().catch(() => {});
							setChecked(true);
						}}
						className={`press inline-flex items-center gap-1.5 rounded-[6px] px-1.5 py-0.5 font-medium hover:bg-ink/[0.07] disabled:hover:bg-transparent ${
							info.updatePhase === "error" ? "text-danger" : "text-ink-2 hover:text-ink"
						}`}
					>
						{busy ? <Spinner size={11} /> : null}
						{action}
					</button>
				</>
			)}
		</div>
	);
}
