export default function ToggleField({ label, value, onChange, hint, tag }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        {label && (
          <label className="text-xs font-medium text-text flex items-center gap-2">
            {label}
            {tag && <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent-sm text-accent">{tag}</span>}
          </label>
        )}
        {hint && <p className="text-[11px] text-text-dim mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${
          value ? 'bg-accent' : 'bg-bg-deep border border-border'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
