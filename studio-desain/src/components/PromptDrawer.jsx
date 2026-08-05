import { useState } from 'react';
import { ChevronUp, ChevronDown, Sparkles, Clock } from 'lucide-react';
import CopyButton from './CopyButton.jsx';
import PromptSectionList from './PromptSectionList.jsx';
import HistoryPanel from './HistoryPanel.jsx';

/**
 * Floating bottom drawer. Collapsed = thin pill. Expanded = ~60vh panel.
 * Supports JSON output (Banner/Typography), text output (Thumbnail),
 * and per-section copy (Typography).
 */
export default function PromptDrawer({
  mode,
  promptText,       // string OR object (for Typography: { json, sections })
  promptLabel,
  primaryColor,
  onGenerate,
  onRestoreHistory,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Normalize prompt for the main copy/view
  let fullText = '';
  let sections = null;
  if (mode === 'typography' && promptText && typeof promptText === 'object' && promptText.sections) {
    fullText = JSON.stringify(promptText.json, null, 2);
    sections = promptText.sections;
  } else if (typeof promptText === 'object') {
    fullText = JSON.stringify(promptText, null, 2);
  } else {
    fullText = String(promptText || '');
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
      <div className="max-w-[1500px] mx-auto px-4 pb-4 pointer-events-auto">
        <div
          className="surface shadow-panel transition-all overflow-hidden"
          style={{ background: 'var(--bg-panel)' }}
        >
          {/* Collapsed pill / expanded toolbar */}
          <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-border">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-2 text-sm font-semibold text-text hover:text-accent transition"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              Output Prompt
              <span className="chip ml-1">
                {mode === 'banner' ? 'JSON Banner' : mode === 'thumbnail' ? 'Text Brief' : 'JSON + 8 Section'}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory((s) => !s)}
                className="btn-ghost"
                title="Riwayat"
              >
                <Clock className="w-3.5 h-3.5" /> Riwayat
              </button>
              <button onClick={onGenerate} className="btn-ghost">
                <Sparkles className="w-3.5 h-3.5 text-accent" /> Generate
              </button>
              <CopyButton getText={() => fullText} label="Copy Prompt" primary />
            </div>
          </div>

          {/* Body */}
          {expanded && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-4 max-h-[60vh] overflow-hidden">
              <div className={`${showHistory ? 'lg:col-span-2' : 'lg:col-span-3'} overflow-hidden flex flex-col gap-3`}>
                {sections ? (
                  <PromptSectionList sections={sections} />
                ) : (
                  <pre className="codeblock max-h-[55vh] overflow-auto flex-1">{fullText}</pre>
                )}
                <div className="text-[10px] text-text-dim mono uppercase tracking-widest">
                  {fullText.length.toLocaleString()} karakter · paste ke ChatGPT / Flux / Ideogram / Leonardo
                </div>
              </div>
              {showHistory && (
                <div className="lg:col-span-1">
                  <HistoryPanel
                    onRestore={onRestoreHistory}
                    onClose={() => setShowHistory(false)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
