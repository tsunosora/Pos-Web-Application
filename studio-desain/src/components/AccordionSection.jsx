import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function AccordionSection({ num, title, icon: Icon, badge, defaultOpen = true, children, headerExtra }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-bg-elev transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-7 h-7 rounded-md bg-accent-sm flex items-center justify-center">
              <Icon className="w-4 h-4 text-accent" />
            </div>
          )}
          <h3 className="text-sm font-semibold text-text">
            {num && <span className="text-text-dim mr-2">{num}.</span>}
            {title}
          </h3>
          {badge && <span className="chip">{badge}</span>}
        </div>
        <div className="flex items-center gap-3">
          {headerExtra}
          <ChevronDown className={`w-4 h-4 text-text-mut transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-border">{children}</div>}
    </section>
  );
}
