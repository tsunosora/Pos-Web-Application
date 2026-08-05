import { lazy } from 'react';

/**
 * React.lazy yang tahan deploy: kalau dynamic import GAGAL (umumnya karena
 * user masih memegang index.html lama yang menunjuk chunk hash lama yang
 * sudah dihapus setelah deploy baru), reload halaman SEKALI untuk mengambil
 * index.html + chunk terbaru. Guard sessionStorage mencegah reload loop.
 *
 * Tanpa ini: section/route gagal load → blank/gap dan user harus refresh manual.
 */
export default function lazyWithRetry(importer, key = 'chunk') {
  return lazy(() =>
    importer().catch((err) => {
      const flag = `af_reload_${key}`;
      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(flag) === '1';
        if (!alreadyReloaded) sessionStorage.setItem(flag, '1');
      } catch {}
      if (!alreadyReloaded && typeof window !== 'undefined') {
        window.location.reload();
        // Halaman akan reload — kembalikan komponen kosong sementara.
        return { default: () => null };
      }
      throw err; // sudah pernah reload & tetap gagal → biarkan ErrorBoundary menangani
    })
  );
}
