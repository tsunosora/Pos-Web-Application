import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import { startNext, NextHandle } from "./next-server";
import { getPrinterConfig, setPrinterConfig } from "./printer-config";
import { printEscpos, listPrinters } from "./printing";

let win: BrowserWindow | null = null;
let next: NextHandle | null = null;

function frontendDir(): string {
  // Override manual (debug/uji bundle standalone tanpa packaging).
  if (process.env.POSPRO_FRONTEND_DIR) return process.env.POSPRO_FRONTEND_DIR;
  // Dev: folder frontend di repo (next start). Produksi: standalone di resources.
  return process.env.POSPRO_DEV
    ? path.join(__dirname, "..", "..", "frontend")
    : path.join(process.resourcesPath, "frontend");
}

async function createWindow() {
  next = await startNext(frontendDir());
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once("ready-to-show", () => win?.show());
  await win.loadURL(next.url);
  if (process.env.POSPRO_DEV) win.webContents.openDevTools({ mode: "detach" });
}

// ---- IPC ----
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("printer-config:get", () => getPrinterConfig());
ipcMain.handle("printer-config:set", (_e, cfg) => setPrinterConfig(cfg));
ipcMain.handle("print:list", () => listPrinters());
ipcMain.handle("print:escpos", (_e, payload) => printEscpos(payload));

app
  .whenReady()
  .then(createWindow)
  .then(() => {
    // Auto-update hanya di app terpaket (bukan dev). Diam bila publish belum diatur.
    if (!process.env.POSPRO_DEV && app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify().catch((e) => log.warn("Cek update gagal:", e));
    }
  })
  .catch((e) => {
    log.error("Gagal start:", e);
    app.quit();
  });

app.on("window-all-closed", () => {
  next?.proc.kill();
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => next?.proc.kill());
