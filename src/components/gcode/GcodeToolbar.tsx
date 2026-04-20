interface Props {
	fileName: string;
	hasPath: boolean;
	isBusy: boolean;
	onBack: () => void;
	onSave: () => void;
	onSaveAs: () => void;
}

export default function GcodeToolbar({ fileName, hasPath, isBusy, onBack, onSave, onSaveAs }: Props) {
	return (
		<header className="h-11 flex items-center gap-2 border-b border-slate-700/60 bg-[#0d1017] px-3 shrink-0">
			<button
				onClick={onBack}
				className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-sm"
			>
				<svg
					viewBox="0 0 12 12"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="w-3.5 h-3.5"
				>
					<path d="M8 2L4 6l4 4" />
				</svg>
				Home
			</button>

			<div className="h-4 w-px bg-slate-700/60" />

			<span className="text-sm font-medium text-gray-300 truncate">{fileName}</span>

			<div className="flex-1" />

			{hasPath && (
				<button
					onClick={onSave}
					disabled={isBusy}
					className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 rounded-lg text-xs font-semibold text-slate-200 transition-colors disabled:opacity-40"
				>
					Save
				</button>
			)}
			<button
				onClick={onSaveAs}
				disabled={isBusy}
				className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 rounded-lg text-xs font-semibold text-slate-200 transition-colors disabled:opacity-40"
			>
				Save As…
			</button>
		</header>
	);
}
