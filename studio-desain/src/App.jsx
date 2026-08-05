import { useState, useEffect, Suspense } from 'react';
import LandingPage from './landing/LandingPage.jsx';
import lazyWithRetry from './lazyWithRetry.js';

// Studio (semua mode + modal + builder) di-code-split: pengunjung landing TIDAK
// mengunduh kode studio sama sekali → first paint landing jauh lebih cepat,
// terutama di HP / koneksi lambat. Chunk studio baru diunduh saat buka /app.
const StudioApp = lazyWithRetry(() => import('./StudioApp.jsx'), 'studio');

function isAppRoute() {
  if (typeof window === 'undefined') return false;
  const host     = window.location.host     || '';
  const pathname = window.location.pathname || '';
  const hash     = window.location.hash     || '';
  return (
    host.startsWith('app.')          ||  // app.brandmu.id subdomain
    pathname === '/app'              ||  // /app exact
    pathname.startsWith('/app/')     ||  // /app/something
    hash === '#/app'                 ||  // legacy hash routing
    hash.startsWith('#/app/')
  );
}

// Splash sederhana saat chunk studio sedang diunduh.
function StudioLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg">
      <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-white font-black text-lg shadow-[0_0_24px_rgba(var(--accent-rgb),0.55)] animate-pulse">
        F
      </div>
      <div className="text-xs text-text-mut mono uppercase tracking-widest">Memuat studio...</div>
    </div>
  );
}

export default function App() {
  const [appRoute, setAppRoute] = useState(isAppRoute);

  useEffect(() => {
    const onRouteChange = () => setAppRoute(isAppRoute());
    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate',  onRouteChange);
    return () => {
      window.removeEventListener('hashchange', onRouteChange);
      window.removeEventListener('popstate',  onRouteChange);
    };
  }, []);

  if (!appRoute) return <LandingPage />;
  return (
    <Suspense fallback={<StudioLoading />}>
      <StudioApp />
    </Suspense>
  );
}
