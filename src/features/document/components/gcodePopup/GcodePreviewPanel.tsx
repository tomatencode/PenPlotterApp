import { useEffect, useMemo, useRef, useState } from "react";
import { virtualRange } from "../../../../shared/virtual";
import { useElementSize } from "../../../../shared/hooks/useElementSize";

interface Props {
	gcode: string;
	isBusy: boolean;
}

// Fixed row height so the virtual window can be computed arithmetically.
// Matches the original row styling (text-xs + leading-relaxed + py-0.5).
const ROW_HEIGHT = 22;
const PADDING = 12; // matches the previous p-3 container padding

export function GcodePreviewPanel({ gcode, isBusy }: Props) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const viewportHeight = useElementSize(scrollRef);
	const [scrollTop, setScrollTop] = useState(0);

	// Split once per GCode string instead of twice per render.
	const lines = useMemo(() => (gcode ? gcode.split(/\r?\n/) : []), [gcode]);
	const lineCount = useMemo(() => lines.filter(Boolean).length, [lines]);

	const { start, end, offsetY, totalHeight } = virtualRange(
		lines.length,
		ROW_HEIGHT,
		scrollTop,
		viewportHeight,
	);

	// A regenerated file replaces the whole list — start back at the top.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0 });
		setScrollTop(0);
	}, [gcode]);

	return (
		<div className="flex-1 flex flex-col min-w-0 border-r border-slate-700/60">
			<div className="px-4 pt-3 pb-2 shrink-0 border-b border-slate-700/60">
				<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">GCode Preview</p>
			</div>
			<div
				ref={scrollRef}
				onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
				className="flex-1 overflow-auto bg-[#0a0c10]"
			>
				{gcode ? (
					// Only the visible slice is mounted; the spacer keeps the scrollbar honest.
					<div
						className="relative font-mono text-xs text-slate-400"
						style={{ height: totalHeight + PADDING * 2 }}
					>
						<div className="absolute left-0 right-0 px-4" style={{ top: PADDING + offsetY }}>
							{lines.slice(start, end).map((line, i) => {
								const lineNumber = start + i + 1;
								return (
									<div
										key={lineNumber}
										className="hover:bg-slate-800/40 flex items-center transition-colors"
										style={{ height: ROW_HEIGHT }}
									>
										<span className="text-slate-700 w-8 shrink-0 text-right tabular-nums select-none">{lineNumber}</span>
										<span className="ml-3 text-slate-300">{line}</span>
									</div>
								);
							})}
						</div>
					</div>
				) : (
					<div className="flex items-center justify-center h-full text-xs text-slate-600 italic">
						{isBusy ? "Generating GCode…" : "Ready"}
					</div>
				)}
			</div>
			<div className="px-4 py-2 border-t border-slate-700/60 shrink-0">
				<p className="text-xs text-slate-600">
					{gcode
						? `${lineCount} lines · ${gcode.length >= 1024 ? `${(gcode.length / 1024).toFixed(1)} KB` : `${gcode.length} B`}`
						: "—"}
				</p>
			</div>
		</div>
	);
}