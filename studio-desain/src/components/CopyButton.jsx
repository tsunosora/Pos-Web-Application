import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyButton({ getText, label = 'Copy', size = 'sm', primary = false, className = '', onCopied }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    const text = typeof getText === 'function' ? getText() : String(getText || '');
    let ok = false;
    // Try modern Clipboard API (HTTPS / localhost only)
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); ok = true; } catch {}
    }
    // Fallback for HTTP / IP access: temp textarea + execCommand
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.left = '-9999px';
        ta.setAttribute('readonly', '');
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {
        console.warn('Copy fallback failed:', e);
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      if (typeof onCopied === 'function') onCopied(text);
    }
  };

  const base = primary ? 'btn-primary' : 'btn-ghost';
  const sizeCls = size === 'xs' ? 'text-[11px] !px-2 !py-1' : '';

  return (
    <button onClick={handle} className={`${base} ${sizeCls} ${className}`}>
      {copied
        ? <><Check className="w-3.5 h-3.5" /> Disalin</>
        : <><Copy className="w-3.5 h-3.5" /> {label}</>}
    </button>
  );
}
