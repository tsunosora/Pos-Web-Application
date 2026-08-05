import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';

const PICKER_W = 220;
const PICKER_H = 290;
const MARGIN = 8;

function Swatch({ color, label, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  // Reposition: place below button, flip if no space, clamp to viewport
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
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onResize = () => place();
    document.addEventListener('mousedown', onClick);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-12 h-10 rounded-md border border-border hover:border-border-strong transition"
        style={{ background: color }}
        aria-label={label}
      />
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
    </>
  );
}

export default function ColorSwatch({ primary, secondary, onPrimary, onSecondary, label = 'Tema Warna' }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-text">{label}</label>}
      <div className="flex items-center gap-3">
        <Swatch color={primary} label="Primary" onChange={onPrimary} />
        <Swatch color={secondary} label="Secondary" onChange={onSecondary} />
        <div className="text-[11px] text-text-dim leading-tight">
          <div>Kiri: <span className="mono text-text-mut">{primary}</span></div>
          <div>Kanan: <span className="mono text-text-mut">{secondary}</span></div>
        </div>
      </div>
    </div>
  );
}
