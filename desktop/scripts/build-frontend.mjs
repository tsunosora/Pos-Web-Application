// Build frontend Next dalam mode "standalone" untuk dipaket ke aplikasi desktop.
// Lintas-platform (dipanggil dari npm script "dist"). Wajib POSPRO_DESKTOP=1
// (mengaktifkan output:standalone) + NODE_ENV=production (hindari bug prerender
// worker saat NODE_ENV=development).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.join(here, "..", "..", "frontend");

console.log("[build-frontend] Membangun frontend (standalone) di", frontend);
const r = spawnSync("npm", ["run", "build"], {
  cwd: frontend,
  stdio: "inherit",
  env: { ...process.env, POSPRO_DESKTOP: "1", NODE_ENV: "production" },
  shell: process.platform === "win32",
});
if (r.status !== 0) {
  console.error("[build-frontend] GAGAL (exit", r.status, ")");
  process.exit(r.status ?? 1);
}
console.log("[build-frontend] Selesai. Output: frontend/.next/standalone");
