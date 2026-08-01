'use client';
import { useCallback, useEffect, useState } from 'react';
import { verifyTvPin } from '@/lib/api/leaderboard-tv';
import TvLeaderboardView from '@/components/leaderboard-tv/TvLeaderboardView';

const PIN_KEY = 'tv_leaderboard_pin_session';
const PIN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 hari (TV jarang re-login)

function readSession(): string | null {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.pin || (s.expires && Date.now() > s.expires)) { localStorage.removeItem(PIN_KEY); return null; }
    return s.pin as string;
  } catch { return null; }
}

export default function TvLeaderboardPage() {
  const [pin, setPin] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { setPin(readSession()); setReady(true); }, []);

  const logout = useCallback(() => { localStorage.removeItem(PIN_KEY); setPin(null); setPinInput(''); }, []);

  const handlePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setLoading(true); setPinError('');
    try {
      const res = await verifyTvPin(pinInput.trim());
      if (res.valid) {
        localStorage.setItem(PIN_KEY, JSON.stringify({ pin: pinInput.trim(), expires: Date.now() + PIN_TTL }));
        setPin(pinInput.trim());
      } else { setPinError('PIN salah.'); setPinInput(''); }
    } catch { setPinError('Tidak bisa menghubungi server.'); }
    finally { setLoading(false); }
  };

  if (!ready) return null; // hindari flash gate saat baca session

  if (!pin) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-primary/90 to-primary p-6">
        <form onSubmit={handlePin} className="bg-card p-8 rounded-2xl shadow-2xl w-full max-w-sm">
          <h1 className="text-2xl font-black mb-1">🏆 Papan Juara TV</h1>
          <p className="text-sm text-muted-foreground mb-5">Masukkan PIN untuk menampilkan leaderboard di layar.</p>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">PIN</label>
          <input type="password" inputMode="numeric" value={pinInput} autoFocus
            onChange={e => setPinInput(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-lg tracking-widest text-center" />
          {pinError && <p className="text-red-600 text-sm mt-2">{pinError}</p>}
          <button type="submit" disabled={loading}
            className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-lg font-semibold disabled:opacity-60">
            {loading ? 'Memeriksa…' : 'Tampilkan'}
          </button>
        </form>
      </div>
    );
  }

  return <TvLeaderboardView pin={pin} onLogout={logout} />;
}
