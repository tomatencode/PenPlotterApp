interface Props {
	phase: string;
	percent: number;
	status: string;
}

export function GcodeProgressBar({ phase, percent, status }: Props) {
	return (
		<div className="px-4 pt-3 pb-2 border-b border-slate-700/60 shrink-0">
			<div className="flex items-center justify-between mb-1.5">
				<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{phase}</p>
				<p className="text-xs text-slate-600 tabular-nums">{percent}%</p>
			</div>
			<div className="w-full h-1.5 rounded-full bg-[#0a0c10] overflow-hidden border border-slate-700/60">
				<div
					className="h-full bg-blue-500/80 rounded-full transition-all duration-500 ease-out"
					style={{ width: `${percent}%` }}
				/>
			</div>
			<p className="text-xs text-slate-600 mt-1.5 h-4">{status}</p>
		</div>
	);
}
