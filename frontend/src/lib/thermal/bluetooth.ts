// frontend/src/lib/thermal/bluetooth.ts
// Manajer koneksi Web Bluetooth untuk printer thermal BLE. Stateful, browser-only.

const OPTIONAL_SERVICES: (number | string)[] = [
  0xffe0,
  0x18f0,
  0xff00,
  '000018f0-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
];
const LS_KEY = 'thermalPrinter.lastName';

/* eslint-disable @typescript-eslint/no-explicit-any */
let device: any = null;
let characteristic: any = null;

export const getLastPrinterName = (): string | null =>
  typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;

export const isPrinterConnected = (): boolean => !!characteristic;

/** Minta user pilih printer BLE lalu ambil characteristic tulis. Butuh gesture user. */
export const connectPrinter = async (): Promise<string> => {
  const bt = (navigator as any).bluetooth;
  if (!bt) {
    throw new Error(
      'Perangkat ini tidak mendukung Bluetooth web (iPhone/Safari?). Gunakan tombol Cetak Browser.',
    );
  }
  device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: OPTIONAL_SERVICES });
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
