import { contextBridge, ipcRenderer } from "electron";

// Base URL API diteruskan dari main via additionalArguments (--pospro-api-base=...).
// Di mode "100% offline" ini menunjuk backend LOKAL; di mode lama = remote/kosong.
const apiArg = process.argv.find((a) => a.startsWith("--pospro-api-base="));
const apiBaseUrl = apiArg ? apiArg.slice("--pospro-api-base=".length) : "";

// Kontrak API yang diekspos ke renderer. Renderer mengenali "sedang di Electron"
// dengan mengecek keberadaan window.electron.
contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  apiBaseUrl,
  appVersion: () => ipcRenderer.invoke("app:version"),
  // Cetak ESC/POS lokal. bytesBase64 = ESC/POS biner base64 (sama seperti relay).
  printEscpos: (payload: {
    bytesBase64: string;
    connection?: "windows" | "usb" | "bluetooth";
    target?: string | null; // nama printer Windows / COM / MAC
  }) => ipcRenderer.invoke("print:escpos", payload),
  // Daftar printer OS untuk dropdown pengaturan.
  listPrinters: () => ipcRenderer.invoke("print:list"),
  // Simpan/baca konfigurasi printer lokal per-device (di userData).
  getPrinterConfig: () => ipcRenderer.invoke("printer-config:get"),
  setPrinterConfig: (cfg: unknown) => ipcRenderer.invoke("printer-config:set", cfg),
  // Backup & reset data lokal (mode 100% offline).
  backupDb: () => ipcRenderer.invoke("db:backup"),
  resetDb: () => ipcRenderer.invoke("db:reset"),
});
