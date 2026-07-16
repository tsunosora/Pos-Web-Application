import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface PrinterConfig {
  connection: "windows" | "usb" | "bluetooth";
  target: string | null; // nama printer Windows / COM5 / MAC
}

const DEFAULT: PrinterConfig = { connection: "windows", target: null };

function file(): string {
  return path.join(app.getPath("userData"), "printer-config.json");
}

export function getPrinterConfig(): PrinterConfig {
  try {
    return { ...DEFAULT, ...JSON.parse(fs.readFileSync(file(), "utf8")) };
  } catch {
    return DEFAULT;
  }
}

export function setPrinterConfig(cfg: Partial<PrinterConfig>): PrinterConfig {
  const merged = { ...DEFAULT, ...cfg };
  fs.writeFileSync(file(), JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
