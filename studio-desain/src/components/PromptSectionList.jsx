import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import CopyButton from './CopyButton.jsx';

export default function PromptSectionList({ sections }) {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div className="surface-elev divide-y divide-border overflow-hidden">
      {sections.map((s, i) => {
        const open = openIdx === i;
        return (
          <div key={s.key}>
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elev transition group"
            >
              <span className="text-xs font-semibold text-accent mono uppercase tracking-wider">{s.label}</span>
              <div className="flex items-center gap-2">
                <CopyButton getText={() => s.text} label="Copy" size="xs" className="opacity-70 group-hover:opacity-100" />
                <ChevronRight className={`w-3.5 h-3.5 text-text-mut transition-transform ${open ? 'rotate-90' : ''}`} />
              </div>
            </button>
            {open && (
              <pre className="codeblock text-[10.5px] m-3 max-h-72 overflow-auto">{s.text}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
