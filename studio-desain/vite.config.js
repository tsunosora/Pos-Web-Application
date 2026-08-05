import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Disajikan di subfolder POS: frontend/public/studio-desain/ → base wajib.
  base: '/studio-desain/',
  plugins: [react()],
  build: {
    // es2017: transpile optional chaining (?.) dkk — HP/WebView lama (pra-2020)
    // gagal PARSE sintaks modern → React tak pernah mount → halaman blank.
    target: 'es2017',
    // Build langsung ke public POS agar disajikan `next start` sebagai statis.
    outDir: '../frontend/public/studio-desain',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    host: true,
  },
});
