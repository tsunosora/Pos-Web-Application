import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // es2017: transpile optional chaining (?.) dkk — HP/WebView lama (pra-2020)
    // gagal PARSE sintaks modern → React tak pernah mount → halaman blank.
    target: 'es2017',
  },
  server: {
    port: 5174,
    host: true,
  },
});
