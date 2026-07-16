import { spawn, ChildProcess, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConnection } from "node:net";
import log from "electron-log";

// Daur hidup MariaDB embedded (portable) untuk mode "100% offline".
// binDir = folder distribusi MariaDB (punya bin/ dan/atau sbin/). Biner dicari di
// binDir, binDir/bin, binDir/sbin. dataDir = folder data (di userData).

const isWin = process.platform === "win32";
const EXE = (n: string) => (isWin ? `${n}.exe` : n);

function resolveBin(binDir: string, candidates: string[]): string {
  const roots = [path.join(binDir, "bin"), path.join(binDir, "sbin"), binDir];
  for (const c of candidates) {
    for (const r of roots) {
      const p = path.join(r, EXE(c));
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error(`Biner MariaDB tak ditemukan (${candidates.join("/")}) di ${binDir}`);
}

export interface MariaHandle {
  port: number;
  proc: ChildProcess;
  stop: () => Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = require("node:net").createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

// Probe TCP: apakah port menerima koneksi (server siap).
function tcpUp(port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host: "127.0.0.1", port });
    const done = (ok: boolean) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

export interface StartMariaOptions {
  binDir: string;
  dataDir: string;
  dbName?: string; // default: pospro
}

export async function startMaria(opts: StartMariaOptions): Promise<MariaHandle> {
  const { binDir, dataDir } = opts;
  const dbName = opts.dbName ?? "pospro";
  const mysqld = resolveBin(binDir, ["mariadbd", "mysqld"]);
  const installDb = resolveBin(binDir, ["mariadb-install-db", "mysql_install_db"]);
  const mysql = resolveBin(binDir, ["mariadb", "mysql"]);
  const port = await freePort();
  // Socket UNIX wajib < ~108 char → taruh di tmpdir yang pendek. Windows pakai TCP.
  const socket = isWin ? undefined : path.join(os.tmpdir(), `pospro-${port}.sock`);

  // Init datadir sekali (first run).
  if (!fs.existsSync(path.join(dataDir, "mysql")) && !fs.existsSync(path.join(dataDir, "data"))) {
    fs.mkdirSync(dataDir, { recursive: true });
    log.info("[maria] init datadir", dataDir);
    const initArgs = [
      "--no-defaults",
      `--basedir=${binDir}`,
      `--datadir=${dataDir}`,
      "--auth-root-authentication-method=normal",
    ];
    const r = spawnSync(installDb, initArgs, { encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`mariadb-install-db gagal: ${r.stderr || r.stdout || r.status}`);
    }
  }

  // Start mysqld.
  const args = [
    "--no-defaults",
    `--basedir=${binDir}`,
    `--datadir=${dataDir}`,
    `--port=${port}`,
    "--bind-address=127.0.0.1",
    `--pid-file=${path.join(dataDir, "mysqld.pid")}`,
  ];
  if (socket) args.push(`--socket=${socket}`);
  log.info("[maria] start", mysqld, "port", port);
  const proc = spawn(mysqld, args, { stdio: "pipe" });
  proc.stdout?.on("data", (d) => log.info("[mariadbd]", d.toString().trim()));
  proc.stderr?.on("data", (d) => log.info("[mariadbd]", d.toString().trim()));
  proc.on("error", (e) => log.error("[mariadbd] spawn error", e));

  // Tunggu port siap.
  const start = Date.now();
  let ready = false;
  while (Date.now() - start < 40000) {
    if (await tcpUp(port)) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) {
    proc.kill();
    throw new Error("MariaDB tidak siap dalam 40s");
  }

  // Pastikan database ada (root empty-password, bind lokal).
  const mkdb = spawnSync(
    mysql,
    ["-h", "127.0.0.1", "-P", String(port), "-u", "root", "-e", `CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`],
    { encoding: "utf8" },
  );
  if (mkdb.status !== 0) {
    log.warn("[maria] create db gagal (mungkin sudah ada):", mkdb.stderr || mkdb.stdout);
  }

  const stop = async () => {
    try {
      const admin = resolveBin(binDir, ["mariadb-admin", "mysqladmin"]);
      spawnSync(admin, ["-h", "127.0.0.1", "-P", String(port), "-u", "root", "shutdown"], {
        encoding: "utf8",
      });
    } catch (e) {
      log.warn("[maria] shutdown via admin gagal, kill proses", e);
    }
    // Beri waktu graceful, lalu pastikan mati.
    await new Promise((r) => setTimeout(r, 2500));
    if (!proc.killed) proc.kill();
  };

  return { port, proc, stop };
}
