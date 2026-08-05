import { useState, useEffect } from 'react';
import { Edit3, Eye } from 'lucide-react';

/**
 * Hybrid SelectField + Custom text input + optional reference modal trigger.
 * Default: dropdown. Klik "✏ Custom" untuk switch ke text input bebas.
 * Kalau pass `onShowReference`, muncul tombol "👁 Lihat Referensi".
 */
export default function SelectOrCustom({
  label, value, onChange, options, hint, required,
  showReference = false, onShowReference,
}) {
  const isInOptions = (v) =>
    (options || []).some((o) => (typeof o === 'object' ? o.value : o) === v);

  const [customMode, setCustomMode] = useState(() => !!value && !isInOptions(value));

  // Sync mode when external value changes (e.g. demo load)
  useEffect(() => {
    if (value && !isInOptions(value)) setCustomMode(true);
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-text">
            {label}{required && <span className="text-accent ml-0.5">*</span>}
          </label>
          <div className="flex items-center gap-2 shrink-0">
            {showReference && (
              <button
                type="button"
                onClick={onShowReference}
                className="text-[10px] uppercase tracking-wider text-accent hover:text-accent-h flex items-center gap-1 transition"
                title="Lihat referensi visual"
              >
                <Eye className="w-3 h-3" /> Lihat Referensi
              </button>
            )}
            <button
              type="button"
              onClick={() => setCustomMode((v) => !v)}
              className="text-[10px] uppercase tracking-wider text-text-dim hover:text-accent flex items-center gap-1 transition"
              title="Toggle custom input"
            >
              <Edit3 className="w-3 h-3" />
              {customMode ? 'Pilih Preset' : 'Custom'}
            </button>
          </div>
        </div>
      )}
      {customMode ? (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Ketik ${label?.toLowerCase() || 'value'} custom...`}
          className="input"
        />
      ) : (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="select">
          {(options || []).map((o) => {
            const v = typeof o === 'object' ? o.value : o;
            const l = typeof o === 'object' ? o.label : o;
            return <option key={String(v)} value={v}>{l}</option>;
          })}
        </select>
      )}
      {hint && <p className="text-[11px] text-text-dim">{hint}</p>}
    </div>
  );
}
