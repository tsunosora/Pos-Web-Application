// Sumber tunggal daftar "tujuan cetak" nota: gabungan format (A5 / Struk 58mm)
// DAN printer yang tersedia, supaya kasir memilih desain + printer sekaligus di
// satu menu — tidak terkunci ke satu model printer / satu desain.
import type { ReceiptSnapshot } from "../receipt";
import { handlePrintSnap } from "../receipt";
import { isDesktop, listPrintersDesktop, getPrinterConfigDesktop } from "./desktop-bridge";
import {
  isRelayAvailable,
  isBridgeAvailable,
  printThermalViaRelay,
  printThermalViaBridge,
  printThermalViaBrowser,
  printThermalBluetoothAuto,
  printThermalDesktopTo,
} from "./print-thermal";
import { getLastPrinterName, connectPrinter } from "./bluetooth";

type Status = "TAGIHAN" | "LUNAS";

export type PrintTarget = {
  id: string;
  format: "A5" | "THERMAL";
  label: string;
  sub?: string;
  /** Cocok dengan setelan format default (settings.receiptDefaultFormat). */
  isDefault?: boolean;
  run: (snap: ReceiptSnapshot, status: Status) => Promise<void> | void;
};

const webBluetooth = () =>
  typeof navigator !== "undefined" && !!(navigator as { bluetooth?: unknown }).bluetooth;

/**
 * Rakit daftar tujuan cetak sesuai lingkungan:
 * - Selalu: Faktur A5 (dialog printer browser → bebas pilih printer apa pun).
 * - Desktop (Electron): tiap printer OS jadi tujuan thermal tersendiri (cetak langsung).
 * - Web: rute thermal yang terdeteksi (printer toko/relay, bridge, Bluetooth, browser).
 */
export async function detectPrintTargets(
  opts: { defaultFormat?: string; bankAccounts?: unknown[] } = {},
): Promise<PrintTarget[]> {
  const a5IsDefault = opts.defaultFormat !== "THERMAL_58";
  const list: PrintTarget[] = [
    {
      id: "a5",
      format: "A5",
      label: "Faktur A5",
      sub: "Kertas besar · printer biasa",
      isDefault: a5IsDefault,
      run: (s, st) => handlePrintSnap(s, st, opts.bankAccounts as never),
    },
  ];

  if (isDesktop()) {
    const [printers, cfg] = await Promise.all([
      listPrintersDesktop().catch(() => [] as { name: string }[]),
      getPrinterConfigDesktop().catch(() => null),
    ]);
    const names = printers.map((p) => p.name);
    // Printer yang dikonfigurasi wajib muncul walau tak terdaftar di listPrinters
    // (mis. koneksi USB/COM atau Bluetooth langsung).
    if (cfg?.target && !names.includes(cfg.target)) names.unshift(cfg.target);
    for (const name of names) {
      const isCfg = cfg?.target === name;
      const connection = isCfg && cfg ? cfg.connection : "windows";
      list.push({
        id: `desktop:${name}`,
        format: "THERMAL",
        label: name,
        sub: isCfg ? "Struk 58mm · printer utama" : "Struk 58mm",
        isDefault: !a5IsDefault && isCfg,
        run: (s, st) => printThermalDesktopTo(s, st, { connection, target: name }),
      });
    }
    if (!names.length) {
      list.push({
        id: "desktop:default",
        format: "THERMAL",
        label: "Printer Aplikasi",
        sub: "Struk 58mm",
        isDefault: !a5IsDefault,
        run: (s, st) => printThermalViaRelay(s, st),
      });
    }
    return list;
  }

  // Web: deteksi rute thermal yang aktif.
  const [relay, bridge] = await Promise.all([
    isRelayAvailable().catch(() => false),
    isBridgeAvailable().catch(() => false),
  ]);
  if (relay)
    list.push({
      id: "relay",
      format: "THERMAL",
      label: "Printer Toko",
      sub: "Struk 58mm · printer server cabang",
      isDefault: !a5IsDefault,
      run: (s, st) => printThermalViaRelay(s, st),
    });
  if (bridge)
    list.push({
      id: "bridge",
      format: "THERMAL",
      label: "Printer Server",
      sub: "Struk 58mm · bridge lokal",
      isDefault: !a5IsDefault && !relay,
      run: (s, st) => printThermalViaBridge(s, st),
    });
  if (webBluetooth()) {
    const bt = getLastPrinterName();
    list.push({
      id: "bt",
      format: "THERMAL",
      label: bt ? `Bluetooth: ${bt}` : "Printer Bluetooth",
      sub: "Struk 58mm",
      isDefault: !a5IsDefault && !relay && !bridge,
      run: (s, st) => printThermalBluetoothAuto(s, st).then(() => {}),
    });
    list.push({
      id: "bt-pick",
      format: "THERMAL",
      label: "Pilih printer Bluetooth…",
      sub: "Sambung / ganti perangkat",
      run: async (s, st) => {
        await connectPrinter();
        await printThermalBluetoothAuto(s, st);
      },
    });
  }
  list.push({
    id: "browser",
    format: "THERMAL",
    label: "Struk 58mm (Browser/PDF)",
    sub: "Cetak lewat dialog browser",
    isDefault: !a5IsDefault && !relay && !bridge && !webBluetooth(),
    run: (s, st) => printThermalViaBrowser(s, st),
  });
  return list;
}
