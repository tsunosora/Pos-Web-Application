export default function SegmentedField({ label, value, onChange, options, hint, tag }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-text flex items-center gap-2">
          {label}
          {tag && <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent-sm text-accent">{tag}</span>}
        </label>
      )}
      <div className="grid gap-1 p-1 rounded-lg bg-bg-deep border border-border" style={{ gridTemplateColumns: options.length > 4 ? 'repeat(auto-fit, minmax(72px,1fr))' : `repeat(${options.length}, minmax(0,1fr))` }}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          const active = v === value;
          return (
            <button
              key={String(v)}
              type="button"
              onClick={() => onChange(v)}
              data-active={active}
              className={`px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                active
                  ? 'bg-accent text-white shadow-[0_0_12px_rgba(var(--accent-rgb),0.35)]'
                  : 'text-text-mut hover:text-text hover:bg-bg-elev'
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-[11px] text-text-dim">{hint}</p>}
    </div>
  );
}
