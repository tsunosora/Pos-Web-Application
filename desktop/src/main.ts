import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import { startNext, NextHandle } from "./next-server";
import { startMaria, MariaHandle } from "./mariadb";
import { startBackend, pushSchema, localJwtSecret, BackendHandle } from "./backend-server";
import { autoBackup, backupDb } from "./db-backup";
import { getPrinterConfig, setPrinterConfig } from "./printer-config";
import { printEscpos, listPrinters } from "./printing";

let win: BrowserWindow | null = null;
let next: NextHandle | null = null;
let maria: MariaHandle | null = null;
let backend: BackendHandle | null = null;

// Referensi untuk backup/reset (mode lokal).
let mariaBin = "";
let mariaPort = 0;
let dbDataDir = "";
let backupsDir = "";

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// Mode "100% offline": jalankan MariaDB + backend LOKAL di dalam app.
// Default: aktif di app terpaket. POSPRO_LOCAL=0 memaksa mode remote (dev/lama).
function localMode(): boolean {
  if (process.env.POSPRO_LOCAL === "0") return false;
  return !!process.env.POSPRO_LOCAL || app.isPackaged;
}

// Konfigurasi pusat (untuk bootstrap + sync) dari file userData/pospro-config.json.
// Ditulis oleh layar setup first-run (atau admin). Bila absen → app tetap jalan lokal
// tapi tanpa sync (dan first-run tak bisa bootstrap → DB kosong).
function loadCentralConfig(): void {
  try {
    const f = path.join(app.getPath("userData"), "pospro-config.json");
    const cfg = JSON.parse(fs.readFileSync(f, "utf8"));
    if (cfg.centralUrl) process.env.POSPRO_CENTRAL_URL = String(cfg.centralUrl);
    if (cfg.bootstrapToken) process.env.POSPRO_CENTRAL_TOKEN = String(cfg.bootstrapToken);
    if (cfg.branchId != null) process.env.POSPRO_BRANCH_ID = String(cfg.branchId);
    if (cfg.deviceName) process.env.POSPRO_DEVICE_NAME = String(cfg.deviceName);
    log.info("[config] pusat:", process.env.POSPRO_CENTRAL_URL || "(tak diset)");
  } catch {
    log.info("[config] pospro-config.json tak ada — lokal tanpa sync");
  }
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
  const stateDir = app.getPath("userData");
  dbDataDir = path.join(stateDir, "db");
  backupsDir = path.join(stateDir, "backups");
  mariaBin = mariaBinDir();
  loadCentralConfig(); // set POSPRO_CENTRAL_* dari file → dipakai backend lokal utk sync
  // Identitas device disimpan di file userData → selamat saat reset DB lokal.
  process.env.POSPRO_DEVICE_TOKEN_FILE = path.join(stateDir, "device-token");

  maria = await startMaria({ binDir: mariaBin, dataDir: dbDataDir, dbName: "pospro" });
  mariaPort = maria.port;
  // connection_limit=1: DB lokal single-user → 1 koneksi. Juga membuat `SET
  // FOREIGN_KEY_CHECKS` (dipakai sync saat apply pull) persist antar-query.
  const databaseUrl = `mysql://root@127.0.0.1:${maria.port}/pospro?connection_limit=1`;

  // Auto-backup sebelum migrasi (jaga-jaga migrasi gagal / rusak).
  autoBackup({ binDir: mariaBin, port: maria.port, backupsDir, stamp: stamp(), keep: 7 });

  pushSchema(backendDir(), databaseUrl); // first run: buat skema; upgrade: sinkron
  const jwtSecret = localJwtSecret(stateDir);
  backend = await startBackend({ backendDir: backendDir(), databaseUrl, jwtSecret });

  const url = `http://127.0.0.1:${backend.port}`;
  log.info("[boot] backend lokal siap:", url);
  return url;
}

// Reset data lokal: matikan stack, hapus datadir, relaunch (bootstrap ulang dari pusat).
// device-token file DIPERTAHANKAN → device tetap sama di pusat.
async function resetLocalData(): Promise<void> {
  await shutdown();
  if (dbDataDir) fs.rmSync(dbDataDir, { recursive: true, force: true });
  app.relaunch();
  app.exit(0);
}

async function createWindow() {
  // apiBaseUrl: lokal (offline penuh) atau remote (mode lama).
  let apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  if (localMode()) {
    try {
      apiBaseUrl = await bootLocalStack();
    } catch (e) {
      // Kemungkinan DB rusak / gagal start → tawarkan reset (tarik ulang dari pusat).
      log.error("[boot] stack lokal gagal:", e);
      const choice = dialog.showMessageBoxSync({
        type: "error",
        title: "Database lokal bermasalah",
        message: "Gagal menyalakan database lokal.",
        detail: String((e as Error)?.message ?? e),
        buttons: ["Reset data lokal & tarik ulang", "Keluar"],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice === 0) {
        await resetLocalData();
        return;
      }
      app.quit();
      return;
    }
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

// Backup manual DB lokal → file pilihan user.
ipcMain.handle("db:backup", async () => {
  if (!mariaPort) throw new Error("Database lokal tidak aktif");
  const res = await dialog.showSaveDialog({
    title: "Simpan cadangan data",
    defaultPath: `pospro-${stamp()}.sql`,
    filters: [{ name: "SQL", extensions: ["sql"] }],
  });
  if (res.canceled || !res.filePath) return { ok: false };
  backupDb({ binDir: mariaBin, port: mariaPort, outFile: res.filePath });
  return { ok: true, path: res.filePath };
});

// Reset data lokal (dengan konfirmasi) → tarik ulang dari pusat.
ipcMain.handle("db:reset", async () => {
  const choice = dialog.showMessageBoxSync({
    type: "warning",
    title: "Reset data lokal",
    message: "Hapus SEMUA data lokal dan tarik ulang dari pusat?",
    detail:
      "Pastikan tak ada transaksi yang belum tersinkron (indikator harus 0). " +
      "Perangkat tetap terdaftar sama di pusat.",
    buttons: ["Reset & tarik ulang", "Batal"],
    defaultId: 1,
    cancelId: 1,
  });
  if (choice === 0) await resetLocalData();
  return { ok: choice === 0 };
});

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
