import type { NextConfig } from "next";

// @ts-ignore
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  // Bundle mandiri untuk aplikasi desktop (Electron). Diaktifkan HANYA saat
  // POSPRO_DESKTOP=1 agar build homelab (next start) tidak berubah. Menghasilkan
  // .next/standalone/server.js + node_modules ter-trace (kecil) untuk dipaket.
  ...(process.env.POSPRO_DESKTOP ? { output: "standalone" as const } : {}),
  turbopack: {
    root: process.cwd(),
  },
};

export default withPWA(nextConfig);

