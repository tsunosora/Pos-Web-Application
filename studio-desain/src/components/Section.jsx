/**
 * Always-open compact section. No collapse/dropdown.
 * Used everywhere instead of the previous AccordionSection.
 */
export default function Section({ num, title, icon: Icon, badge, children, headerExtra, className = '' }) {
  return (
    <section className={`surface overflow-hidden ${className}`}>
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 bg-bg-elev/40">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-7 h-7 rounded-md bg-accent-sm flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-accent" />
            </div>
          )}
          <h3 className="text-sm font-semibold text-text leading-none">
            {num && <span className="text-text-dim mr-2 mono text-[11px]">{num}.</span>}
            {title}
          </h3>
          {badge && <span className="chip">{badge}</span>}
        </div>
        {headerExtra && <div className="flex items-center gap-2">{headerExtra}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
