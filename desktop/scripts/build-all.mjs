// Siapkan SEMUA artefak untuk packaging aplikasi desktop "100% offline":
//  - backend: nest build + prisma generate (engine Windows).
//  - frontend: build standalone (POSPRO_DESKTOP=1, NODE_ENV=production).
// Lintas-platform. Dipanggil dari npm script "dist".
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const backend = path.join(root, "backend");
const frontend = path.join(root, "frontend");
const win = process.platform === "win32";

function run(cmd, args, cwd, env = {}) {
  console.log(`\n[build-all] ${cmd} ${args.join(" ")}  (cwd=${path.basename(cwd)})`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: win, env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`[build-all] GAGAL: ${cmd} ${args.join(" ")} (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

// 1) Backend: build + generate (engine Windows via binaryTargets di schema).
run("npm", ["run", "build"], backend, { NODE_ENV: "production" });
run("npx", ["prisma", "generate"], backend);

// 2) Frontend: standalone.
run("npm", ["run", "build"], frontend, { POSPRO_DESKTOP: "1", NODE_ENV: "production" });

// 3) Cek biner MariaDB tersedia (wajib untuk paket).
const mariaDir = path.join(here, "..", "mariadb");
const hasMaria =
  fs.existsSync(path.join(mariaDir, "bin")) || fs.existsSync(path.join(mariaDir, "sbin"));
if (!hasMaria) {
  console.warn(
    "\n[build-all] PERINGATAN: desktop/mariadb/ belum berisi biner MariaDB portable.\n" +
      "  Unduh MariaDB ZIP (Windows) → ekstrak isinya ke desktop/mariadb/ (harus ada bin/).\n" +
      "  Tanpa ini, installer terbentuk tapi aplikasi tak bisa menyalakan DB lokal.",
  );
}

console.log("\n[build-all] Selesai. Lanjut: tsc main + electron-builder.");
