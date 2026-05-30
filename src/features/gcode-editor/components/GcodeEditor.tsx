import { useRef } from "react";

interface Props {
	gcode: string;
	onChange: (value: string) => void;
}

export default function GcodeEditor({ gcode, onChange }: Props) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const lineNumbersRef = useRef<HTMLDivElement>(null);

	const lines = gcode.split(/\r?\n/);

	function syncScroll() {
		if (textareaRef.current && lineNumbersRef.current) {
			lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
		}
	}

	return (
		<div className="flex-1 flex overflow-hidden bg-[#0a0c10]">
			{/* Line numbers */}
			<div
				ref={lineNumbersRef}
				className="w-12 shrink-0 overflow-hidden text-right font-mono text-xs text-slate-700 select-none bg-[#0a0c10] border-r border-slate-800 pt-3 pb-3 pr-2"
				aria-hidden="true"
			>
				{lines.map((_, i) => (
					<div key={i} className="leading-6 px-1">
						{i + 1}
					</div>
				))}
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
