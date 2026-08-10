import { useEffect, useRef, useState } from 'react';
import { Stamp, Upload, Trash2, Download } from 'lucide-react';
import Section from './Section.jsx';
import TextField from './TextField.jsx';
import SelectField from './SelectField.jsx';
import TextareaField from './TextareaField.jsx';
import { LOGO_POSITIONS } from '../data/logoOptions.js';

const LOGO_KEY = 'studio_brand_logo';   // logo brand tersimpan (data URL) — dibagi lintas mode
const MAX_BYTES = 2 * 1024 * 1024;      // 2MB

/**
 * Bagian "Logo & Brand" lintas mode + uploader logo.
 * Logo disimpan di localStorage (per browser) sbg data URL — dipakai untuk preview
 * & unduh cepat agar mudah dilampirkan ke tool AI. Prompt hanya menyertakan direktif
 * logo bila `useLogo` aktif (lihat prompts/logoBlock.js). Gambar TIDAK masuk prompt.
 *
 * Props: state, set (curried SET_FIELD), num (opsional).
 */
export default function LogoBrandSection({ state, set, num }) {
  const [logoImg, setLogoImg] = useState('');
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    try { setLogoImg(localStorage.getItem(LOGO_KEY) || ''); } catch { /* ignore */ }
  }, []);

  const handleFile = (file) => {
    setErr('');
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('File harus gambar (PNG/JPG/SVG/WebP).'); return; }
    if (file.size > MAX_BYTES) { setErr('Ukuran maksimal 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      try { localStorage.setItem(LOGO_KEY, url); } catch { setErr('Gagal menyimpan (penyimpanan browser penuh).'); return; }
      setLogoImg(url);
      set('useLogo')(true);                       // auto-aktifkan logo saat di-upload
      if (!state.logoText) set('logoText')(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const removeLogo = () => {
    setLogoImg(''); setErr('');
    try { localStorage.removeItem(LOGO_KEY); } catch { /* ignore */ }
  };

  const download = () => {
    if (!logoImg) return;
    const ext = (logoImg.match(/^data:image\/([a-z0-9.+-]+)/i)?.[1] || 'png').replace('svg+xml', 'svg');
    const a = document.createElement('a');
    a.href = logoImg;
    a.download = `logo-${(state.logoText || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <Section num={num} title="Logo & Brand" icon={Stamp}>
      <label className="flex items-center gap-2 text-sm font-medium text-text cursor-pointer">
        <input
          type="checkbox"
          checked={!!state.useLogo}
          onChange={(e) => set('useLogo')(e.target.checked)}
          className="accent-accent w-4 h-4"
        />
        Tampilkan logo brand pada desain
      </label>

      <div className={`mt-3 space-y-3 ${state.useLogo ? '' : 'opacity-60'}`}>
        {/* Uploader logo */}
        <div>
          <label className="text-xs font-medium text-text">Gambar Logo</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          {logoImg ? (
            <div className="mt-1.5 flex items-center gap-3 surface p-3 rounded-lg">
              <div
                className="w-16 h-16 rounded-md flex items-center justify-center overflow-hidden shrink-0 border border-border"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%),linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%)',
                  backgroundSize: '12px 12px',
                  backgroundPosition: '0 0,6px 6px',
                }}
              >
                <img src={logoImg} alt="logo" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost text-xs !py-1.5 !px-3">
                  <Upload className="w-3.5 h-3.5" /> Ganti
                </button>
                <button type="button" onClick={download} className="btn-ghost text-xs !py-1.5 !px-3">
                  <Download className="w-3.5 h-3.5" /> Unduh
                </button>
                <button type="button" onClick={removeLogo} className="btn-ghost text-xs !py-1.5 !px-3 text-red-500">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`mt-1.5 w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition
                ${dragOver ? 'border-accent bg-accent-sm/40' : 'border-border hover:border-accent'}`}
            >
              <Upload className="w-5 h-5 text-text-dim" />
              <span className="text-xs text-text-mut">Klik atau seret file logo ke sini</span>
              <span className="text-[10px] text-text-dim">PNG / JPG / SVG / WebP · maks 2MB</span>
            </button>
          )}
          {err && <p className="text-[11px] text-red-500 mt-1">{err}</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <TextField
            label="Nama / Teks Logo"
            value={state.logoText}
            onChange={set('logoText')}
            placeholder="AuraSkin"
          />
          <SelectField
            label="Posisi Logo"
            value={state.logoPosition}
            onChange={set('logoPosition')}
            options={LOGO_POSITIONS}
          />
        </div>
        <TextareaField
          label="Catatan Konsistensi Brand (Opsional)"
          value={state.logoNotes}
          onChange={set('logoNotes')}
          rows={2}
          placeholder="Warna brand hijau tosca, logo jangan diubah bentuk/warnanya, ukuran ± 12% lebar"
        />
        <p className="text-[11px] text-text-dim leading-relaxed">
          💡 Logo tersimpan di browser ini. Saat generate di AI (ChatGPT/Gemini/Nano-Banana),
          <b> seret file logo ke chat</b> (atau klik <b>Unduh</b> lalu lampirkan) <b>bersama prompt</b>.
          Prompt sudah menyuruh AI memakai logo itu <b>tanpa mengubahnya</b> agar konsisten.
        </p>
      </div>
    </Section>
  );
}
