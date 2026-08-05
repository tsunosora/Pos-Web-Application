export default function TextField({ label, value, onChange, placeholder, required, counter, hint }) {
  const words = (value || '').trim().split(/\s+/).filter(Boolean).length;
  const chars = (value || '').length;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text">
            {label}{required && <span className="text-accent ml-0.5">*</span>}
          </label>
          {counter && (
            <span className="text-[10px] mono text-text-dim">
              {words} kata · {chars} karakter
            </span>
          )}
        </div>
      )}
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="input"
      />
      {hint && <p className="text-[11px] text-text-dim">{hint}</p>}
    </div>
  );
}
