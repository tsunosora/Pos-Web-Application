import { Eye } from 'lucide-react';

export default function SelectField({ label, value, onChange, options, hint, showReference, onShowReference, tag }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text flex items-center gap-2">
            {label}
            {tag && <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent-sm text-accent">{tag}</span>}
          </label>
          {showReference && (
            <button
              type="button"
              onClick={onShowReference}
              className="text-[10px] uppercase tracking-wider text-accent hover:text-accent-h flex items-center gap-1"
            >
              <Eye className="w-3 h-3" /> Lihat Referensi
            </button>
          )}
        </div>
      )}
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="select">
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={String(v)} value={v}>{l}</option>;
        })}
      </select>
      {hint && <p className="text-[11px] text-text-dim">{hint}</p>}
    </div>
  );
}
