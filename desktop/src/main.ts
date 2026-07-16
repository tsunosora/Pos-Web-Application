import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import { startNext, NextHandle } from "./next-server";
import { startMaria, MariaHandle } from "./mariadb";
import { startBackend, pushSchema, localJwtSecret, BackendHandle } from "./backend-server";
import { getPrinterConfig, setPrinterConfig } from "./printer-config";
import { printEscpos, listPrinters } from "./printing";

let win: BrowserWindow | null = null;
let next: NextHandle | null = null;
let maria: MariaHandle | null = null;
let backend: BackendHandle | null = null;

// Mode "100% offline": jalankan MariaDB + backend LOKAL di dalam app.
function localMode(): boolean {
  return !!process.env.POSPRO_LOCAL;
}

function frontendDir(): string {
  if (process.env.POSPRO_FRONTEND_DIR) return process.env.POSPRO_FRONTEND_DIR;
  return process.env.POSPRO_DEV
    ? path.join(__dirname, "..", "..", "frontend")
    : path.join(process.resourcesPath, "frontend");
}

function backendDir(): string {
  return process.env.POSPRO_BACKEND_DIR
    ? process.env.POSPRO_BACKEND_DIR
    : process.env.POSPRO_DEV
      ? path.join(__dirname, "..", "..", "backend")
      : path.join(process.resourcesPath, "backend");
}

function mariaBinDir(): string {
  if (process.env.POSPRO_MARIADB_DIR) return process.env.POSPRO_MARIADB_DIR;
  return path.join(process.resourcesPath, "mariadb");
}

// Nyalakan stack lokal (DB + backend). Return base URL API lokal.
async function bootLocalStack(): Promise<string> {
  const dataDir = path.join(app.getPath("userData"), "db");
  const stateDir = app.getPath("userData");

  maria = await startMaria({ binDir: mariaBinDir(), dataDir, dbName: "pospro" });
  // connection_limit=1: DB lokal single-user → 1 koneksi. Juga membuat `SET
  // FOREIGN_KEY_CHECKS` (dipakai sync saat apply pull) persist antar-query.
  const databaseUrl = `mysql://root@127.0.0.1:${maria.port}/pospro?connection_limit=1`;

  pushSchema(backendDir(), databaseUrl); // first run: buat skema; upgrade: sinkron
  const jwtSecret = localJwtSecret(stateDir);
  backend = await startBackend({ backendDir: backendDir(), databaseUrl, jwtSecret });

  const url = `http://127.0.0.1:${backend.port}`;
  log.info("[boot] backend lokal siap:", url);
  return url;
}

async function createWindow() {
  // apiBaseUrl: lokal (offline penuh) atau remote (mode lama).
  let apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  if (localMode()) {
    apiBaseUrl = await bootLocalStack();
  }

  next = await startNext(frontendDir());

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Teruskan base URL API ke renderer (dibaca preload).
      additionalArguments: [`--pospro-api-base=${apiBaseUrl}`],
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
    if (!process.env.POSPRO_DEV && app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify().catch((e) => log.warn("Cek update gagal:", e));
    }
  })
  .catch((e) => {
    log.error("Gagal start:", e);
    dialog.showErrorBox("POS Pro gagal start", String(e?.message ?? e));
    app.quit();
  });

let quitting = false;

async function shutdown() {
  next?.proc.kill();
  next = null;
  backend?.proc.kill();
  backend = null;
  if (maria) {
    const m = maria;
    maria = null;
    await m.stop(); // matikan DB dengan rapi (hindari korupsi)
  }
}

app.on("window-all-closed", () => app.quit());

// Cleanup sekali, lalu keluar paksa (app.exit tak memicu before-quit lagi → tak loop/nyangkut).
app.on("before-quit", (e) => {
  if (quitting) return;
  quitting = true;
  e.preventDefault();
  shutdown().finally(() => app.exit(0));
});
