import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import log from "electron-log";
import { getPrinterConfig } from "./printer-config";
import { listPrintersWindows, printRawWindows, printSerialWindows } from "./win-print";

export interface PrintPayload {
  bytesBase64: string;
  connection?: "windows" | "usb" | "bluetooth";
  target?: string | null;
}

export interface PrintResult {
  ok: boolean;
  error?: string;
  target?: string;
}

const isWin = process.platform === "win32";

export async function listPrinters(): Promise<{ name: string }[]> {
  try {
    if (isWin) return await listPrintersWindows();
    // Dev Linux/macOS: daftar antrean CUPS.
    const out = await run("lpstat", ["-e"]);
    return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((name) => ({ name }));
  } catch (e) {
    log.warn("listPrinters gagal", e);
    return [];
  }
}

export async function printEscpos(payload: PrintPayload): Promise<PrintResult> {
  // Baca config hanya bila payload tak lengkap (hindari app.getPath di luar Electron).
  let connection = payload.connection;
  let target = payload.target ?? null;
  if (connection == null || target == null) {
    const cfg = getPrinterConfig();
    connection = connection ?? cfg.connection;
    target = target ?? cfg.target;
  }
  const data = Buffer.from(payload.bytesBase64, "base64");

  if (!data.length) return { ok: false, error: "Data cetak kosong" };

  // Tulis byte ke file sementara biner (dipakai PowerShell / lp).
  const tmp = path.join(os.tmpdir(), `pospro-print-${process.pid}-${Date.now()}.bin`);
  try {
    fs.writeFileSync(tmp, data);

    if (process.env.POSPRO_PRINT_DRYRUN) {
      log.info(`[DRYRUN] cetak ${data.length} byte → ${connection}/${target ?? "?"} (${tmp})`);
      return { ok: true, target: target ?? undefined };
    }

    if (connection === "windows") {
      if (!target) throw new Error("Nama printer Windows belum diset");
      if (isWin) await printRawWindows(target, tmp);
      else await lpRaw(target, tmp); // dev: perlakukan target sbg nama antrean CUPS
    } else if (connection === "usb" || connection === "bluetooth") {
      if (!target) throw new Error("COM port belum diset");
      if (isWin) await printSerialWindows(target, tmp);
      else await serialPosix(target, data); // dev: tulis langsung ke device path
    } else {
      throw new Error(`Koneksi tak dikenal: ${connection}`);
    }
    return { ok: true, target: target ?? undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("printEscpos gagal", msg);
    return { ok: false, error: msg, target: target ?? undefined };
  } finally {
    fs.rm(tmp, () => {});
  }
}

// ---- helper dev (non-Windows) ----
function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `${cmd} exit ${code}`))));
  });
}

async function lpRaw(printer: string, tmpFile: string): Promise<void> {
  await run("lp", ["-d", printer, "-o", "raw", tmpFile]);
}

async function serialPosix(devPath: string, data: Buffer): Promise<void> {
  await fs.promises.writeFile(devPath, data);
}
