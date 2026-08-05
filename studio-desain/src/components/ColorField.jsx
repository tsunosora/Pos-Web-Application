import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';

/**
 * Single color picker — swatch button + label + hex, dengan popover HexColorPicker.
 * Dipakai untuk kontrol warna individual (mis. warna teks / background / suasana).
 */
const PICKER_W = 220;
const PICKER_H = 290;
const MARGIN = 8;

export default function ColorField({ label, value, onChange, hint }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const color = value || '#ffffff';

  const place = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    let top = r.bottom + 6;
    let left = r.left;
    if (top + PICKER_H > window.innerHeight - MARGIN) top = r.top - PICKER_H - 6;
    if (top < MARGIN) top = MARGIN;
    if (left + PICKER_W > window.innerWidth - MARGIN) left = window.innerWidth - PICKER_W - MARGIN;
    if (left < MARGIN) left = MARGIN;
    setPos({ top, left });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const onScroll = () => place();
    document.addEventListener('mousedown', onClick);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-text">{label}</label>}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:border-border-strong transition bg-bg-deep"
      >
        <span className="w-6 h-6 rounded border border-border shrink-0" style={{ background: color }} />
        <span className="text-xs mono text-text-mut">{color}</span>
      </button>
      {hint && <p className="text-[11px] text-text-dim">{hint}</p>}
      {open && createPortal(
        <div
          ref={popRef}
          className="fixed z-[100] surface p-3 shadow-panel animate-fade-in"
          style={{ top: pos.top, left: pos.left, width: PICKER_W }}
        >
          <HexColorPicker color={color} onChange={onChange} />
          <input
            type="text"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="input mt-3 text-xs mono"
          />
        </div>,
        document.body
      )}
    </div>
  );
}
