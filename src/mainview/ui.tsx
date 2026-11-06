import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { copyText } from "./rpc";

// ── Icons: 20px grid, 1.6 stroke, round joins (Focus Timer's set) ──────────

const PATHS = {
	play: <path d="M7.5 5.2v9.6l7.6-4.8z" fill="currentColor" stroke="none" />,
	pause: (
		<>
			<rect x="6" y="5" width="2.8" height="10" rx="1" fill="currentColor" stroke="none" />
			<rect x="11.2" y="5" width="2.8" height="10" rx="1" fill="currentColor" stroke="none" />
		</>
	),
	back: <path d="M12 4.5L6.5 10l5.5 5.5" />,
	pin: (
		<>
			<path d="M7.5 3.5h5l-.8 4.6 2.8 2.9H5.5l2.8-2.9z" />
			<path d="M10 11v5.5" />
		</>
	),
	copy: (
		<>
			<rect x="7" y="7" width="9" height="9" rx="2" />
			<path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" />
		</>
	),
	check: <path d="M5 10.5l3 3 7-7" />,
	send: <path d="M10 15.5v-11M5.5 9L10 4.5 14.5 9" />,
	retry: (
		<>
			<path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9" />
			<path d="M14.5 3.5v3h-3" />
		</>
	),
	key: (
		<>
			<circle cx="7" cy="10" r="3" />
			<path d="M10 10h7M14.5 10v2.5M17 10v2" />
		</>
	),
	folder: <path d="M3.5 6.5a2 2 0 0 1 2-2h3l1.5 1.8h4.5a2 2 0 0 1 2 2v5.7a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			width={size}
			height={size}
			fill="none"
			stroke="currentColor"
			strokeWidth={1.6}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden
		>
			{PATHS[name]}
		</svg>
	);
}

// ── Controls ────────────────────────────────────────────────────────────────

export function Segmented<T extends string>({
	options,
	value,
	onChange,
	label,
	size = "md",
}: {
	options: Array<{ value: T; label: ReactNode; disabled?: boolean }>;
	value: T;
	onChange: (v: T) => void;
	label: string;
	size?: "sm" | "md";
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
	const index = options.findIndex((o) => o.value === value);

	useLayoutEffect(() => {
		const el = ref.current?.children[index + 1] as HTMLElement | undefined;
		setThumb(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
	}, [index, options.length]);

	const pad = size === "sm" ? "px-2.5 h-[24px] text-[11.5px]" : "px-3.5 h-[28px] text-[12.5px]";
	return (
		<div
			ref={ref}
			role="radiogroup"
			aria-label={label}
			className="relative inline-flex rounded-[8px] bg-ink/[0.06] p-[3px] dark:bg-ink/[0.07]"
		>
			<span
				aria-hidden
				className="absolute top-[3px] bottom-[3px] rounded-[6px] bg-surface ring-1 ring-line transition-all duration-[420ms] ease-spring dark:bg-surface-2"
				style={{ left: thumb?.x ?? 0, width: thumb?.w ?? 0, opacity: thumb ? 1 : 0 }}
			/>
			{options.map((o) => (
				<button
					key={o.value}
					role="radio"
					aria-checked={o.value === value}
					disabled={o.disabled}
					onClick={() => onChange(o.value)}
					className={`press relative z-10 rounded-[6px] font-medium disabled:opacity-35 ${pad} ${
						o.value === value ? "text-ink" : "text-ink-2 hover:text-ink"
					}`}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

export function Button({
	children,
	onClick,
	tone = "default",
	disabled,
	busy,
	icon,
}: {
	children: ReactNode;
	onClick: () => void;
	tone?: "default" | "accent";
	disabled?: boolean;
	busy?: boolean;
	icon?: IconName;
}) {
	const tones =
		tone === "accent"
			? "bg-accent text-accent-ink hover:brightness-105"
			: "bg-ink/[0.06] text-ink hover:bg-ink/[0.1] dark:bg-ink/[0.08] dark:hover:bg-ink/[0.12]";
	return (
		<button
			onClick={onClick}
			disabled={disabled || busy}
			className={`press inline-flex h-[30px] items-center gap-1.5 rounded-[7px] px-3 text-[12.5px] font-medium disabled:opacity-50 ${tones}`}
		>
			{busy ? <Spinner /> : icon ? <Icon name={icon} size={14} /> : null}
			{children}
		</button>
	);
}

export function IconButton({
	icon,
	label,
	onClick,
	active,
	className = "",
}: {
	icon: IconName;
	label: string;
	onClick: () => void;
	active?: boolean;
	className?: string;
}) {
	return (
		<button
			onClick={onClick}
			aria-label={label}
			title={label}
			aria-pressed={active}
			className={`press grid h-[28px] w-[28px] place-items-center rounded-[7px] ${
				active ? "bg-accent/15 text-accent" : "text-ink-2 hover:bg-ink/[0.07] hover:text-ink"
			} ${className}`}
		>
			<Icon name={icon} size={16} />
		</button>
	);
}

/** Text button that confirms with "Copied" for a moment. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>();
	useEffect(() => () => clearTimeout(timer.current), []);
	return (
		<button
			onClick={async () => {
				await copyText(text);
				setCopied(true);
				clearTimeout(timer.current);
				timer.current = setTimeout(() => setCopied(false), 1400);
			}}
			className={`press inline-flex h-[24px] items-center gap-1 rounded-[6px] px-2 text-[11.5px] font-medium ${
				copied ? "text-accent" : "text-ink-2 hover:bg-ink/[0.07] hover:text-ink"
			}`}
		>
			<Icon name={copied ? "check" : "copy"} size={13} />
			{copied ? "Copied" : label}
		</button>
	);
}

export function Spinner({ size = 14 }: { size?: number }) {
	return (
		<svg viewBox="0 0 20 20" width={size} height={size} className="animate-spin" aria-hidden>
			<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
			<path d="M17 10a7 7 0 0 0-7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

/** Animated bars, the app's one visual motif. */
export function Bars({ heights, active, className = "" }: { heights: number[]; active?: boolean; className?: string }) {
	return (
		<div className={`flex items-center gap-[3px] ${active ? "listening" : ""} ${className}`} aria-hidden>
			{heights.map((h, i) => (
				<span
					key={i}
					className="w-[3px] rounded-full bg-current"
					style={{ height: h, ["--i" as string]: i }}
				/>
			))}
		</div>
	);
}
