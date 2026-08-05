import { Trash2, Clock } from 'lucide-react';
import { useHistory } from '../context/HistoryContext.jsx';

export default function HistoryPanel({ onRestore, onClose }) {
  const { entries, remove, clear } = useHistory();

  return (
    <div className="surface-elev p-4 max-h-[60vh] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5 text-accent" /> Riwayat Prompt
          <span className="chip">{entries.length}</span>
        </div>
        {entries.length > 0 && (
          <button onClick={clear} className="text-[10px] text-text-mut hover:text-red-400 uppercase tracking-wider">
            Hapus Semua
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center text-xs text-text-dim py-10">Belum ada prompt yang di-generate.</div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="py-2.5 flex items-start justify-between gap-3 group">
              <button
                onClick={() => { onRestore(e); onClose && onClose(); }}
                className="flex-1 text-left flex items-start gap-3 hover:bg-bg-elev px-2 py-1 -mx-2 rounded transition"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                  style={{ background: e.primaryColor || 'var(--accent)' }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-text truncate">{e.label || 'Untitled'}</div>
                  <div className="text-[10px] text-text-dim mono mt-0.5">
                    {e.mode} · {new Date(e.ts).toLocaleString()}
                  </div>
                </div>
              </button>
              <button
                onClick={() => remove(e.id)}
                className="text-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                title="Hapus"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
