import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import log from "electron-log";

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
  throw new Error(`Biner dump tak ditemukan (${candidates.join("/")}) di ${binDir}`);
}

/** Dump DB lokal `pospro` ke file .sql. Return path file. */
export function backupDb(opts: {
  binDir: string;
  port: number;
  outFile: string;
  dbName?: string;
}): string {
  const dump = resolveBin(opts.binDir, ["mariadb-dump", "mysqldump"]);
  const db = opts.dbName ?? "pospro";
  fs.mkdirSync(path.dirname(opts.outFile), { recursive: true });
  const out = fs.openSync(opts.outFile, "w");
  try {
    const r = spawnSync(
      dump,
      ["-h", "127.0.0.1", "-P", String(opts.port), "-u", "root", "--single-transaction", "--databases", db],
      { stdio: ["ignore", out, "pipe"], encoding: "utf8" },
    );
    if (r.status !== 0) {
      throw new Error(`dump gagal: ${r.stderr || r.status}`);
    }
  } finally {
    fs.closeSync(out);
  }
  log.info("[backup] tersimpan:", opts.outFile);
  return opts.outFile;
}

/** Auto-backup ke folder userData/backups dengan rotasi (simpan `keep` terbaru). */
export function autoBackup(opts: {
  binDir: string;
  port: number;
  backupsDir: string;
  stamp: string; // timestamp string (dari main, hindari Date di util)
  keep?: number;
}): string | null {
  try {
    const outFile = path.join(opts.backupsDir, `pospro-${opts.stamp}.sql`);
    backupDb({ binDir: opts.binDir, port: opts.port, outFile });
    rotate(opts.backupsDir, opts.keep ?? 7);
    return outFile;
  } catch (e) {
    log.warn("[backup] auto-backup gagal", e);
    return null;
  }
}

function rotate(dir: string, keep: number): void {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("pospro-") && f.endsWith(".sql"))
      .sort(); // nama ber-timestamp → urut kronologis
    while (files.length > keep) {
      const f = files.shift();
      if (f) fs.rmSync(path.join(dir, f), { force: true });
    }
  } catch {
    /* abaikan */
  }
}
