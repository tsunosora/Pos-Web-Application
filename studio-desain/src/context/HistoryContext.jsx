import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const HistoryContext = createContext(null);
const KEY = 'af_history_v1';
const MAX = 30;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function HistoryProvider({ children }) {
  const [entries, setEntries] = useState(load);

  useEffect(() => {
    const persist = (list) => {
      try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
      catch { return false; }
    };
    if (persist(entries)) return;
    // Kuota localStorage penuh (mis. entri carousel/news yang besar karena teks
    // berita disisipkan tiap slide). Jangan diam-diam gagal: buang entri TERLAMA
    // satu per satu sampai muat, supaya riwayat terbaru tetap tersimpan.
    for (let n = entries.length - 1; n >= 1; n--) {
      if (persist(entries.slice(0, n))) return;
    }
    // Bahkan 1 entri pun tak muat → simpan versi ramping tanpa snapshot besar.
    try {
      const slim = entries.slice(0, 1).map(({ snapshot, ...rest }) => rest);
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {}
  }, [entries]);

  const add = useCallback((entry) => {
    setEntries((prev) => {
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const next = [{ id, ts: Date.now(), ...entry }, ...prev];
      return next.slice(0, MAX);
    });
  }, []);

  const remove = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  // Import: ganti seluruh riwayat (sanitasi → cuma object valid, batasi MAX).
  const replaceAll = useCallback((arr) => {
    if (!Array.isArray(arr)) return 0;
    const clean = arr
      .filter((e) => e && typeof e === 'object')
      .map((e) => ({
        id: e.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
        ts: typeof e.ts === 'number' ? e.ts : Date.now(),
        ...e,
      }))
      .slice(0, MAX);
    setEntries(clean);
    return clean.length;
  }, []);

  return (
    <HistoryContext.Provider value={{ entries, add, remove, clear, replaceAll }}>
      {children}
    </HistoryContext.Provider>
  );
}

export const useHistory = () => useContext(HistoryContext);
