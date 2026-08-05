import { useState } from 'react';
import { X, Plus } from 'lucide-react';

export default function FeatureChipsField({ label, value = [], onChange, hint, placeholder = 'Ketik fitur lalu Enter atau koma' }) {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return;
    onChange([...value, ...items]);
    setDraft('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === ',') {
      e.preventDefault();
      add(draft);
    }
  };

  const removeAt = (i) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text">{label}</label>
          <span className="chip">{value.length} fitur</span>
        </div>
      )}
      <div className="surface-elev p-2 min-h-[100px] flex flex-wrap gap-2 items-start">
        {value.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-sm text-accent text-xs">
            {v}
            <button type="button" onClick={() => removeAt(i)} className="hover:text-accent-h">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : '+ tambah'}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-dim min-w-[120px] px-1"
        />
        {draft && (
          <button type="button" onClick={() => add(draft)} className="text-accent hover:text-accent-h">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-text-dim">{hint}</p>}
    </div>
  );
}
