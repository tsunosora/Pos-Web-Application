import { useState } from 'react';
import { Sparkles, Wand2, Lightbulb, Loader2, ArrowRight } from 'lucide-react';
import { AI_MODES, AI_MODE_LIST } from '../data/aiFields.js';
import { aiIdeas, aiFill } from '../ai/aiClient.js';

/**
 * Bar asisten AI di atas form: isi otomatis brief mode aktif, saran ide konten,
 * dan pilih mode yang cocok dari saran.
 *
 * Props:
 *   mode        — id mode aktif (mis. 'fotoproduk')
 *   applyFill   — (targetMode, values) => void  — dispatch nilai ke state mode terkait
 *   onPickMode  — (modeId) => void              — pindah mode aktif
 */
export default function AiAssistBar({ mode, applyFill, onPickMode }) {
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(null); // 'fill' | 'ideas' | 'pick:<id>'
  const [error, setError] = useState('');
  const [ideas, setIdeas] = useState([]);

  const modeLabel = AI_MODES[mode]?.label || mode;

  const runFill = async () => {
    if (!idea.trim() || busy) return;
    setBusy('fill'); setError('');
    try {
      const spec = AI_MODES[mode];
      const { values } = await aiFill(idea.trim(), spec.label, spec.fields);
      if (!values || !Object.keys(values).length) throw new Error('AI tidak mengembalikan isian. Coba ide lebih spesifik.');
      applyFill(mode, values);
    } catch (e) {
      setError(e.message || 'Gagal mengisi brief.');
    } finally { setBusy(null); }
  };

  const runIdeas = async () => {
    if (!idea.trim() || busy) return;
    setBusy('ideas'); setError(''); setIdeas([]);
    try {
      const { ideas: got } = await aiIdeas(idea.trim(), AI_MODE_LIST);
      if (!got?.length) throw new Error('Belum ada ide. Coba deskripsikan produk/tujuanmu.');
      setIdeas(got);
    } catch (e) {
      setError(e.message || 'Gagal mengambil ide.');
    } finally { setBusy(null); }
  };

  const pickIdea = async (it) => {
    if (busy) return;
    const target = AI_MODES[it.modeId] ? it.modeId : mode;
    setBusy(`pick:${it.title}`); setError('');
    try {
      if (target !== mode) onPickMode(target);
      const spec = AI_MODES[target];
      const composed = `${it.title}. ${it.hook}. Konteks awal: ${idea.trim()}`;
      const { values } = await aiFill(composed, spec.label, spec.fields);
      applyFill(target, values);
    } catch (e) {
      setError(e.message || 'Gagal menerapkan ide.');
    } finally { setBusy(null); }
  };

  return (
    <div className="surface p-4 mb-4 border border-accent-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-accent-sm flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
        </div>
        <h3 className="text-sm font-semibold text-text">Asisten AI</h3>
        <span className="text-[10px] uppercase tracking-widest text-text-dim mono">isi brief otomatis</span>
      </div>

      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={2}
        placeholder={`Ceritakan produk / tujuan kontenmu…\ncontoh: "sunscreen SPF50 untuk remaja, harga terjangkau, mau viral di IG"`}
        className="input resize-y w-full"
      />

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button onClick={runFill} disabled={!idea.trim() || !!busy} className="btn-primary text-xs !py-2 !px-3 disabled:opacity-50">
          {busy === 'fill' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          Isi Otomatis <span className="opacity-70">· {modeLabel}</span>
        </button>
        <button onClick={runIdeas} disabled={!idea.trim() || !!busy} className="btn-ghost text-xs !py-2 !px-3 disabled:opacity-50">
          {busy === 'ideas' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
          Saran Ide Konten
        </button>
      </div>

      {error && <p className="text-[12px] text-red-500 mt-2">{error}</p>}

      {ideas.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-text-dim uppercase tracking-widest mono">Pilih ide → AI isi briefnya:</p>
          {ideas.map((it, i) => {
            const label = AI_MODE_LIST.find((m) => m.id === it.modeId)?.label || it.modeId;
            const loading = busy === `pick:${it.title}`;
            return (
              <button
                key={i}
                onClick={() => pickIdea(it)}
                disabled={!!busy}
                className="w-full text-left surface hover:border-accent transition p-3 rounded-lg disabled:opacity-50 group"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text">{it.title}</div>
                    {it.hook && <div className="text-[12px] text-text-mut mt-0.5">{it.hook}</div>}
                    <div className="text-[10px] mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-sm text-accent uppercase tracking-wider">
                      {label}{it.reason ? ` · ${it.reason}` : ''}
                    </div>
                  </div>
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0 mt-1" />
                    : <ArrowRight className="w-4 h-4 text-text-dim group-hover:text-accent shrink-0 mt-1" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
