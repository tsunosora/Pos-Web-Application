// frontend/src/lib/thermal/bluetooth.ts
// Manajer koneksi Web Bluetooth untuk printer thermal BLE. Stateful, browser-only.

const OPTIONAL_SERVICES: (number | string)[] = [
  0xffe0,
  0x18f0,
  0xff00,
  '000018f0-0000-1000-8000-00805f9b34fb', // service cetak RPP02N / banyak thermal BLE (char tulis 0x2af1)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // service vendor RPP02N (varian)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC/microchip (beberapa thermal)
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
];
const LS_KEY = 'thermalPrinter.lastName';

/* eslint-disable @typescript-eslint/no-explicit-any */
let device: any = null;
let characteristic: any = null;

export const getLastPrinterName = (): string | null =>
  typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;

export const isPrinterConnected = (): boolean => !!characteristic;

/** Sambungkan GATT dari `device` yang sudah dipilih & ambil characteristic tulis. */
const connectGatt = async (): Promise<string> => {
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  characteristic = null;
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    const w = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
    if (w) {
      characteristic = w;
      break;
    }
  }
  if (!characteristic) {
    throw new Error('Printer terhubung tapi tak ada jalur tulis. Coba printer thermal lain.');
  }
  device.addEventListener('gattserverdisconnected', () => {
    characteristic = null;
  });
  try {
    localStorage.setItem(LS_KEY, device.name || 'Printer');
  } catch {
    /* ignore */
  }
  return device.name || 'Printer';
};

/** Minta user pilih printer BLE lalu ambil characteristic tulis. Butuh gesture user. */
export const connectPrinter = async (): Promise<string> => {
  const bt = (navigator as any).bluetooth;
  if (!bt) {
    throw new Error(
      'Perangkat ini tidak mendukung Bluetooth web (iPhone/Safari?). Gunakan tombol Cetak Browser.',
    );
  }
  device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: OPTIONAL_SERVICES });
  return connectGatt();
};

/**
 * Pastikan printer siap tanpa memaksa dialog pemilihan:
 * 1) kalau sudah terhubung → langsung pakai.
 * 2) coba sambung ulang ke printer yang sudah pernah diizinkan (getDevices, tanpa dialog).
 * 3) fallback → buka dialog pemilihan (butuh gesture user; dipanggil dari onClick).
 */
export const ensureConnected = async (): Promise<string> => {
  if (characteristic) return device?.name || 'Printer';
  const bt = (navigator as any).bluetooth;
  if (bt?.getDevices) {
    try {
      const known: any[] = await bt.getDevices();
      const last = getLastPrinterName();
      const dev = known.find((d) => d.name === last) || known[0];
      if (dev) {
        device = dev;
        return await connectGatt();
      }
    } catch {
      /* lanjut ke pemilihan manual */
    }
  }
  return connectPrinter();
};

/** Kirim byte per-chunk kecil dengan jeda (printer BLE murah rawan overflow). */
export const sendBytes = async (bytes: Uint8Array, chunkSize = 180, delayMs = 20): Promise<void> => {
  if (!characteristic) throw new Error('Printer belum terhubung.');
  const useNoResp = !!characteristic.properties.writeWithoutResponse;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    if (useNoResp) await characteristic.writeValueWithoutResponse(chunk);
    else await characteristic.writeValue(chunk);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
};

export const disconnectPrinter = (): void => {
  try {
    device?.gatt?.disconnect();
  } catch {
    /* ignore */
  }
  characteristic = null;
};
