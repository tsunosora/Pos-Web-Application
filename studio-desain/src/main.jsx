import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import StudioApp from './StudioApp.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { HistoryProvider } from './context/HistoryContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

// Mode EMBED (dipasang lewat VITE_EMBED=1 saat build): app disematkan di dalam
// POS (/desainer) → langsung tampil Studio, TANPA landing & login bawaan.
const EMBED = import.meta.env.VITE_EMBED === '1';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <HistoryProvider>
            {EMBED ? <StudioApp /> : <App />}
          </HistoryProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

// Tandai React sudah mount — dipakai watchdog di index.html (anti splash selamanya).
window.__AF_MOUNTED = true;

// Remove the initial Hero skeleton once React has rendered first paint.
// Smooth fade-out so transition to the real React Hero is seamless.
requestAnimationFrame(() => {
  const initial = document.getElementById('initial-hero')
    || document.getElementById('initial-loader'); // legacy fallback
  if (initial) {
    initial.classList.add('is-hiding');
    setTimeout(() => initial.remove(), 350);
  }
});
