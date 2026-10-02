import { useMemo, useRef, useState } from "react";
import { virtualRange } from "../../../shared/virtual";
import { useElementSize } from "../../../shared/hooks/useElementSize";

interface Props {
	gcode: string;
	onChange: (value: string) => void;
}

// The gutter mirrors the textarea's metrics exactly, so its rows line up:
// `leading-6` gives a 24px line box and `p-3` adds 12px of top padding.
const ROW_HEIGHT = 24;
const PADDING_TOP = 12;

export default function GcodeEditor({ gcode, onChange }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const viewportHeight = useElementSize(containerRef);
	const [scrollTop, setScrollTop] = useState(0);

	// Only the count is needed — avoid keeping a copy of every line around.
	const lineCount = useMemo(() => gcode.split(/\r?\n/).length, [gcode]);
	const { start, end, offsetY } = virtualRange(lineCount, ROW_HEIGHT, scrollTop, viewportHeight);

	// The gutter is not a scroll container, so the scrolled-away distance has to
	// be subtracted by hand to keep its rows aligned with the textarea's.
	const gutterTop = PADDING_TOP + offsetY - scrollTop;

	function syncScroll() {
		setScrollTop(textareaRef.current?.scrollTop ?? 0);
	}

	return (
		<div ref={containerRef} className="flex-1 flex overflow-hidden bg-[#0a0c10]">
			{/* Line numbers — virtualised; only the visible range is rendered. */}
			<div
				className="w-12 shrink-0 relative overflow-hidden text-right font-mono text-xs text-slate-700 select-none bg-[#0a0c10] border-r border-slate-800"
				aria-hidden="true"
			>
				<div className="absolute left-0 right-0 pr-2" style={{ top: gutterTop }}>
					{Array.from({ length: end - start }, (_, i) => (
						<div key={start + i} className="leading-6 px-1">
							{start + i + 1}
						</div>
					))}
				</div>
			</div>

			{/* Editor */}
			<textarea
				ref={textareaRef}
				value={gcode}
				onChange={(e) => onChange(e.target.value)}
				onScroll={syncScroll}
				spellCheck={false}
				className="flex-1 min-w-0 resize-none bg-transparent font-mono text-xs text-slate-300 leading-6 p-3 outline-none caret-white/70 placeholder-slate-700"
				placeholder="Paste or type GCode here…"
			/>
		</div>
	);
}