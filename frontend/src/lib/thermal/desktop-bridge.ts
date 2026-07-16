// Jembatan ke aplikasi desktop (Electron). Bila web app berjalan di dalam Electron,
// preload meng-inject window.electron → cetak langsung ke printer OS via IPC,
// TANPA agen relay / agent.py / .bat.

export interface ElectronPrinterConfig {
  connection: "windows" | "usb" | "bluetooth";
  target: string | null;
}

interface ElectronAPI {
  platform: string;
  appVersion: () => Promise<string>;
  printEscpos: (p: {
    bytesBase64: string;
    connection?: string;
    target?: string | null;
  }) => Promise<{ ok: boolean; error?: string; target?: string }>;
  listPrinters: () => Promise<{ name: string }[]>;
  getPrinterConfig: () => Promise<ElectronPrinterConfig>;
  setPrinterConfig: (cfg: ElectronPrinterConfig) => Promise<ElectronPrinterConfig>;
  // Auto-update (opsional — hanya ada di app terpaket).
  onUpdaterEvent?: (cb: (data: UpdaterEvent) => void) => () => void;
  checkUpdate?: () => Promise<unknown>;
  downloadUpdate?: () => Promise<unknown>;
  installUpdate?: () => Promise<unknown>;
}

export type UpdaterEvent =
  | { type: "none" }
  | { type: "available"; version: string }
  | { type: "progress"; percent: number }
  | { type: "ready"; version: string }
  | { type: "error"; message: string };

function api(): ElectronAPI | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { electron?: ElectronAPI }).electron ?? null;
}

/** API Electron mentah (null bila bukan desktop). Dipakai fitur seperti auto-update. */
export function getElectron(): ElectronAPI | null {
  return api();
}

/** True bila web app sedang berjalan di dalam aplikasi desktop Electron. */
export function isDesktop(): boolean {
  return api() !== null;
}

/** Kirim byte ESC/POS (base64) langsung ke printer lokal via Electron. */
export async function printEscposDesktop(bytesBase64: string): Promise<void> {
  const el = api();
  if (!el) throw new Error("Bukan lingkungan desktop");
  const cfg = await el.getPrinterConfig();
  const res = await el.printEscpos({ bytesBase64, connection: cfg.connection, target: cfg.target });
  if (!res.ok) throw new Error(res.error || "Gagal mencetak di printer lokal");
}

/** Daftar printer OS (untuk dropdown pengaturan di mode desktop). */
export async function listPrintersDesktop(): Promise<{ name: string }[]> {
  const el = api();
  if (!el) return [];
  return el.listPrinters();
}

export async function getPrinterConfigDesktop(): Promise<ElectronPrinterConfig | null> {
  const el = api();
  if (!el) return null;
  return el.getPrinterConfig();
}

export async function setPrinterConfigDesktop(cfg: ElectronPrinterConfig): Promise<void> {
  const el = api();
  if (!el) return;
  await el.setPrinterConfig(cfg);
}

/** Uji cetak dengan config sementara (belum tentu tersimpan). */
export async function testPrintDesktop(bytesBase64: string, cfg: ElectronPrinterConfig): Promise<void> {
  const el = api();
  if (!el) throw new Error("Bukan lingkungan desktop");
  const res = await el.printEscpos({ bytesBase64, connection: cfg.connection, target: cfg.target });
  if (!res.ok) throw new Error(res.error || "Gagal uji cetak");
}

/** Uint8Array → base64 (aman utk data besar di browser/Electron renderer). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
