import { Check } from 'lucide-react';

export default function CheckboxGroupField({ label, values = [], onChange, options, hint, max, tag, columns = 2 }) {
  const set = new Set(values);
  const toggle = (v) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else {
      if (max && next.size >= max) return; // cap reached
      next.add(v);
    }
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text flex items-center gap-2">
            {label}
            {tag && <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent-sm text-accent">{tag}</span>}
          </label>
          {max && (
            <span className="text-[10px] mono text-text-dim">
              {set.size}/{max}
            </span>
          )}
        </div>
      )}
      <div
        className="grid gap-1.5"
        style={{
          // Responsive columns: capped at requested `columns`, but auto-shrinks
          // to 2 cols on narrow viewports so labels (e.g. "Face Shape", "Eyebrows")
          // don't get truncated/hidden.
          gridTemplateColumns: `repeat(auto-fit, minmax(min(110px, 100%), 1fr))`,
          maxWidth: columns >= 4 ? '100%' : undefined,
        }}
      >
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          const active = set.has(v);
          const blocked = !active && max && set.size >= max;
          return (
            <button
              key={String(v)}
              type="button"
              onClick={() => toggle(v)}
              disabled={blocked}
              data-active={active}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all border ${
                active
                  ? 'bg-accent-sm text-accent border-border-strong'
                  : blocked
                  ? 'bg-bg-deep text-text-dim border-border opacity-50 cursor-not-allowed'
                  : 'bg-bg-deep text-text-mut border-border hover:text-text hover:border-border-strong'
              }`}
              title={l}
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                  active ? 'bg-accent border-accent' : 'border-border'
                }`}
              >
                {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </span>
              <span className="leading-tight">{l}</span>
            </button>
          );
        })}
      </div>
      {hint && <p className="text-[11px] text-text-dim">{hint}</p>}
    </div>
  );
}
