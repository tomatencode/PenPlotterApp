import { useState } from "react";
import type { ReactNode } from "react";

interface Props<T> {
  value: T | null;
  options: T[];
  onChange: (value: T) => void;
  /** Returns a stable React key for each option. */
  keyOf: (item: T) => string | number;
  /** Renders the content inside the trigger button for the currently selected value. */
  renderSelected: (value: T) => ReactNode;
  /** Renders the content inside each option row. */
  renderOption: (item: T) => ReactNode;
  /** Equality check used to filter out the selected item. Defaults to `===`. */
  isEqual?: (a: T, b: T) => boolean;
  /** Disables the trigger button. */
  disabled?: boolean;
  /** Shown in the trigger when value is null. */
  placeholder?: ReactNode;
}

export function InlineDropdown<T>({
  value,
  options,
  onChange,
  keyOf,
  renderSelected,
  renderOption,
  isEqual = (a, b) => a === b,
  disabled,
  placeholder,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const others = value !== null
    ? options.filter((o) => !isEqual(o, value))
    : [...options];

  return (
    <div
      className="flex-1 rounded-lg border bg-[#0a0c10] overflow-hidden transition-colors border-slate-700/60"
    >
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800/40 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {value !== null ? renderSelected(value) : placeholder}
        {options.length > 0 && (
          <svg
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-3 h-3 text-slate-600 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
        )}
      </button>

      {/* Options */}
      {open && others.length > 0 && (
        <div className="border-t border-slate-700/60">
          {others.map((opt) => (
            <button
              key={keyOf(opt)}
              onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800/40 border-b border-slate-700/30 last:border-b-0 text-left transition-colors"
            >
              {renderOption(opt)}
            </button>
          ))}
        </div>
      )}
      {open && others.length === 0 && (
        <div className="border-t border-slate-700/60 px-2 py-1.5 text-xs text-slate-600 italic">
          No other options available
        </div>
      )}
    </div>
  );
}
