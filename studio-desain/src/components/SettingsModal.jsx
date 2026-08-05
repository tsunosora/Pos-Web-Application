import { useRef, useState } from 'react';
import { X, Sun, Moon, Trash2, Download, Upload, Database, Shield, Info, User, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useHistory } from '../context/HistoryContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { CONFIG } from '../config.js';

export default function SettingsModal({ open, onClose }) {
  const { theme, setTheme } = useTheme();
  const { entries, clear, replaceAll } = useHistory();
  const { session, logout } = useAuth();
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  if (!open) return null;

  // Approximate storage size
  let storageSize = '—';
  try {
    const k1 = localStorage.getItem('af_history_v1') || '';
    const k2 = localStorage.getItem('af_theme') || '';
    const bytes = (k1.length + k2.length) * 2; // each char ~2 bytes (UTF-16)
    storageSize = bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  } catch {}

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2200); };

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auto-feeds-history-${Date.now()}.json`;
    a.click();
    flash('Riwayat berhasil di-export');
  };

  const importHistory = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('Format tidak valid');
        const n = replaceAll(data); // update state + auto-persist (no reload, no race)
        flash(`✓ Import ${n} entri sukses`);
      } catch (err) {
        flash('Gagal import: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input → bisa import file sama lagi
  };

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 py-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface shadow-panel w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-bg-panel z-10">
          <h2 className="text-base font-semibold">Pengaturan</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Akun */}
        <Group icon={User} label="Akun">
          <div className="space-y-2 text-xs">
            <Row label="Email login">
              <span className="text-text mono">{session?.email || '—'}</span>
            </Row>
          </div>
          {!confirmLogout ? (
            <button
              onClick={() => setConfirmLogout(true)}
              className="btn-ghost text-xs mt-3 text-red-400 hover:text-red-300 hover:border-red-500/40"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          ) : (
            <div className="surface-elev p-3 mt-3 flex flex-col gap-2">
              <div className="text-xs text-text">Logout sekarang? Kamu harus login ulang dengan email + password.</div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmLogout(false)} className="btn-ghost text-xs flex-1">Batal</button>
                <button
                  onClick={() => { logout(); onClose && onClose(); }}
                  className="btn-primary text-xs flex-1 !bg-red-500 hover:!bg-red-600"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </Group>

        {/* Tampilan */}
        <Group icon={Sun} label="Tampilan">
          <div className="grid grid-cols-2 gap-2">
            <ThemeChoice active={theme === 'dark'}  onClick={() => setTheme('dark')}  icon={Moon} label="Dark Mode" />
            <ThemeChoice active={theme === 'light'} onClick={() => setTheme('light')} icon={Sun}  label="Light Mode" />
          </div>
          <p className="text-[11px] text-text-mut mt-2">Pilihan tema otomatis disimpan di browser kamu.</p>
        </Group>

        {/* Data & Privasi */}
        <Group icon={Database} label="Data & Privasi">
          <div className="space-y-2 text-xs">
            <Row label="Data tersimpan">
              <span className="mono text-text">{entries.length} prompt · {storageSize}</span>
            </Row>
            <Row label="Lokasi data">
              <span className="text-text">Browser ini saja (localStorage)</span>
            </Row>
            <Row label="Backend / cloud sync">
              <span className="text-text-mut">Tidak ada — fully local</span>
            </Row>
          </div>
          <p className="text-[11px] text-text-mut mt-3">
            Semua data (riwayat prompt + preferensi tema) tersimpan <strong>hanya di device ini</strong>.
            Tidak dikirim ke server, tidak tersinkron antar-device. Hapus cache browser = hapus data.
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={exportHistory} className="btn-ghost text-xs" disabled={entries.length === 0}>
              <Download className="w-3.5 h-3.5" /> Export Riwayat
            </button>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost text-xs">
              <Upload className="w-3.5 h-3.5" /> Import Riwayat
            </button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importHistory} />
          </div>
        </Group>

        {/* Reset */}
        <Group icon={Trash2} label="Reset">
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:border-red-500/40" disabled={entries.length === 0}>
              <Trash2 className="w-3.5 h-3.5" /> Hapus Semua Riwayat
            </button>
          ) : (
            <div className="surface-elev p-3 flex flex-col gap-2">
              <div className="text-xs text-text">Yakin hapus {entries.length} riwayat? Tindakan ini permanen.</div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmClear(false)} className="btn-ghost text-xs flex-1">Batal</button>
                <button onClick={() => { clear(); setConfirmClear(false); flash('Riwayat dihapus'); }}
                  className="btn-primary text-xs flex-1 !bg-red-500 hover:!bg-red-600">Hapus</button>
              </div>
            </div>
          )}
        </Group>

        {/* Tentang */}
        <Group icon={Info} label="Tentang">
          <div className="space-y-1.5 text-xs text-text-mut">
            <Row label="App">{CONFIG.brandName}</Row>
            <Row label="Versi">v2.1.0</Row>
          </div>
        </Group>

        {/* Toast */}
        {msg && (
          <div className="sticky bottom-0 px-5 py-3 border-t border-border bg-accent-sm text-accent text-xs text-center mono">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ icon: Icon, label, children }) {
  return (
    <section className="px-5 py-4 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-widest mono text-text">{label}</h3>
      </div>
      {children}
    </section>
  );
}

function ThemeChoice({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition ${
        active
          ? 'bg-accent-sm border-accent text-accent'
          : 'border-border text-text-mut hover:border-border-strong hover:text-text'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-mut">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
