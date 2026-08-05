import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
import { Palette, Pipette } from 'lucide-react';

/**
 * 3-color custom picker — primary + secondary + accent.
 * Untuk Logo mode: replace preset color palette dengan custom HEX.
 */

const PICKER_W = 220;
const PICKER_H = 290;
const MARGIN = 8;

function Swatch({ color, label, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

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
    <div className="flex flex-col items-center gap-1.5">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-14 h-14 rounded-lg border-2 border-border hover:border-accent transition shadow-sm"
        style={{ background: color }}
        aria-label={label}
      />
      <div className="text-[10px] mono uppercase tracking-widest text-text-dim">{label}</div>
      <div className="text-[10px] mono text-text-mut">{color}</div>
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

export default function CustomColorPicker({ primary, secondary, accent, onPrimary, onSecondary, onAccent, label = 'Custom Color Palette' }) {
  return (
    <div className="surface-elev p-4">
      <div className="flex items-center gap-2 mb-3">
        <Pipette className="w-3.5 h-3.5 text-accent" />
        <div className="text-xs font-semibold text-text">{label}</div>
      </div>
      <div className="flex items-start justify-around gap-4">
        <Swatch color={primary}   label="Primary"   onChange={onPrimary} />
        <Swatch color={secondary} label="Secondary" onChange={onSecondary} />
        <Swatch color={accent}    label="Accent"    onChange={onAccent} />
      </div>
      <p className="text-[10px] text-text-dim mt-3 leading-relaxed">
        ⚠️ Custom color akan override preset palette di atas. Format HEX (#xxxxxx).
      </p>
    </div>
  );
}
