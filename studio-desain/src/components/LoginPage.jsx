import { useState } from 'react';
import { Mail, Lock, LogIn, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { CONFIG, brandParts } from '../config.js';
import ThemeToggle from './ThemeToggle.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await login(email, password);
      if (!r.ok) setError(r.error);
    } catch (e) {
      setError('Terjadi kesalahan: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-accent/15 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />

      {/* Theme toggle (corner) */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 shadow-[0_0_32px_rgba(var(--accent-rgb),0.45)] mb-4 rounded-2xl">
            <img
              src={CONFIG.logoUrl}
              alt={CONFIG.brandName}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent && !parent.querySelector('.logo-fallback')) {
                  const fb = document.createElement('span');
                  fb.className = 'logo-fallback w-full h-full bg-accent flex items-center justify-center text-white font-black text-2xl rounded-2xl';
                  fb.textContent = 'F';
                  parent.appendChild(fb);
                }
              }}
            />
          </div>
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            {brandParts().lead && <>{brandParts().lead} </>}<span className="text-accent">{brandParts().accent}</span>
            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent text-white mono font-bold">LIVE</span>
          </h1>
          <p className="text-xs text-text-mut mt-1.5 mono uppercase tracking-widest">{CONFIG.tagline}</p>
        </div>

        {/* Card */}
        <div className="surface shadow-panel">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-base font-semibold">Masuk ke Studio</h2>
            <p className="text-xs text-text-mut mt-1">Login dengan email yang kamu daftarkan saat order.</p>
          </div>

          <form onSubmit={submit} className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-medium text-text mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim pointer-events-none z-10" />
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@kamu.com"
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-text">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="text-[10px] uppercase tracking-widest text-accent hover:text-accent-h mono"
                >
                  {showPwd ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim pointer-events-none z-10" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password dari email order"
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full !py-3 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</>
              ) : (
                <><LogIn className="w-4 h-4" /> Masuk <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
