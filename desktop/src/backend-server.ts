import { spawn, ChildProcess, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import log from "electron-log";

// Jalankan NestJS backend LOKAL via Electron-as-Node, terhubung ke MariaDB embedded.
// backendDir = folder backend (punya dist/src/main.js + node_modules + prisma).

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

/** Secret JWT lokal per-instal (disimpan di dataDir, dibuat sekali). */
export function localJwtSecret(stateDir: string): string {
  const f = path.join(stateDir, "jwt-secret");
  try {
    return fs.readFileSync(f, "utf8").trim();
  } catch {
    const s = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(f, s, "utf8");
    return s;
  }
}

/** Jalankan `prisma db push` ke DB lokal via Electron-as-Node (tanpa npx). */
export function pushSchema(backendDir: string, databaseUrl: string): void {
  const prismaEntry = path.join(backendDir, "node_modules", "prisma", "build", "index.js");
  if (!fs.existsSync(prismaEntry)) {
    throw new Error(`Prisma CLI tak ditemukan: ${prismaEntry}`);
  }
  log.info("[backend] prisma db push → DB lokal");
  const r = spawnSync(process.execPath, [prismaEntry, "db", "push", "--skip-generate"], {
    cwd: backendDir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DATABASE_URL: databaseUrl },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`prisma db push gagal: ${r.stderr || r.stdout}`);
  }
  log.info("[backend] schema tersinkron");
}

export interface StartBackendOptions {
  backendDir: string;
  databaseUrl: string;
  jwtSecret: string;
}

export interface BackendHandle {
  port: number;
  proc: ChildProcess;
}

export async function startBackend(opts: StartBackendOptions): Promise<BackendHandle> {
  const { backendDir, databaseUrl, jwtSecret } = opts;
  const entry = path.join(backendDir, "dist", "src", "main.js");
  if (!fs.existsSync(entry)) {
    throw new Error(`Backend entry tak ditemukan: ${entry} (jalankan build backend)`);
  }
  const port = await freePort();
  log.info("[backend] start", entry, "port", port);

  const proc = spawn(process.execPath, [entry], {
    cwd: backendDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      JWT_SECRET: jwtSecret,
      ALLOWED_ORIGINS: "*", // lokal: renderer memuat dari 127.0.0.1 acak
      WHATSAPP_ENABLED: "false", // device kasir tak perlu bot WA
    },
    stdio: "pipe",
  });
  proc.stdout?.on("data", (d) => log.info("[backend]", d.toString().trim()));
  proc.stderr?.on("data", (d) => log.warn("[backend]", d.toString().trim()));
  proc.on("error", (e) => log.error("[backend] spawn error", e));

  const url = `http://127.0.0.1:${port}`;
  const start = Date.now();
  while (Date.now() - start < 40000) {
    try {
      await fetch(url, { method: "HEAD" });
      return { port, proc };
    } catch {
      /* belum siap */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error("Backend lokal tidak siap dalam 40s");
}
