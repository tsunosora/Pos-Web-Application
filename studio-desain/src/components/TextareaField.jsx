export default function TextareaField({ label, value, onChange, placeholder, rows = 3, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-text">{label}</label>}
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="input resize-y"
      />
      {hint && <p className="text-[11px] text-text-dim">{hint}</p>}
    </div>
  );
}
