import { btnSlate } from "../../../../shared/styles";

interface Props {
	onClose: () => void;
}

export function GcodeHeader({ onClose }: Props) {
	return (
		<header className="flex items-center justify-between border-b border-slate-700/60 px-4 py-2 shrink-0">
			<div className="flex items-center gap-3">
				<span className="text-sm font-semibold text-gray-200">Export to GCode</span>
				<span className="text-xs text-slate-600 hidden md:block">Preview and upload to a plotter, or save to a file.</span>
			</div>
			<button
				onClick={onClose}
				className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${btnSlate}`}
			>
				Close
			</button>
		</header>
	);
}
