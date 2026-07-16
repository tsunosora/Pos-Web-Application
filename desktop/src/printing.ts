// STUB Fase 1 — implementasi nyata (cetak RAW Windows + serial) diisi di Fase 2
// setelah spike pemilihan pustaka cetak (Task 2.1). Signature harus stabil karena
// dipakai IPC di main.ts.
import log from "electron-log";

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

export async function listPrinters(): Promise<{ name: string }[]> {
  log.warn("listPrinters: stub Fase 1 — belum diimplementasi");
  return [];
}

export async function printEscpos(_payload: PrintPayload): Promise<PrintResult> {
  log.warn("printEscpos: stub Fase 1 — belum diimplementasi");
  return { ok: false, error: "Cetak lokal belum diimplementasi (Fase 2)" };
}
