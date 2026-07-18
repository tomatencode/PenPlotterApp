interface Props {
	gcode: string;
	isBusy: boolean;
}

export function GcodePreviewPanel({ gcode, isBusy }: Props) {
	return (
		<div className="flex-1 flex flex-col min-w-0 border-r border-slate-700/60">
			<div className="px-4 pt-3 pb-2 shrink-0 border-b border-slate-700/60">
				<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">GCode Preview</p>
			</div>
			<div className="flex-1 overflow-auto bg-[#0a0c10]">
				{gcode ? (
					<div className="p-3 font-mono text-xs text-slate-400 leading-relaxed">
						{gcode.split(/\r?\n/).map((line, idx) => (
							<div key={idx} className="hover:bg-slate-800/40 flex px-1 py-0.5 transition-colors">
								<span className="text-slate-700 w-8 shrink-0 text-right tabular-nums select-none">{idx + 1}</span>
								<span className="ml-3 text-slate-300">{line}</span>
							</div>
						))}
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
						? `${gcode.split(/\r?\n/).filter(Boolean).length} lines · ${gcode.length >= 1024 ? `${(gcode.length / 1024).toFixed(1)} KB` : `${gcode.length} B`}`
						: "—"}
				</p>
			</div>
		</div>
	);
}
