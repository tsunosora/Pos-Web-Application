import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { validateLogin, SESSION_TTL_MS, clearAuthCache } from '../auth/auth.js';

const AuthContext = createContext(null);
const KEY = 'af_session_v1';

function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.email || !s.expiresAt) return null;
    if (Date.now() > s.expiresAt) {
      // expired — clear
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  // Re-check expiry on mount + every 30s while app open
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      if (Date.now() > session.expiresAt) {
        localStorage.removeItem(KEY);
        setSession(null);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [session]);

  const login = useCallback(async (email, password) => {
    const result = await validateLogin(email, password);
    if (!result.ok) return result;

    const now = Date.now();
    const newSession = {
      email: result.email,
      loggedInAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };
    try { localStorage.setItem(KEY, JSON.stringify(newSession)); } catch {}
    setSession(newSession);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
      clearAuthCache();
    } catch {}
    setSession(null);
  }, []);

  const isAuthenticated = !!session;
  const expiresInDays = session ? Math.max(0, Math.ceil((session.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))) : 0;

  return (
    <AuthContext.Provider value={{ session, isAuthenticated, login, logout, expiresInDays }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
