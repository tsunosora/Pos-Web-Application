// frontend/src/lib/thermal/index.ts
export * from './escpos';
export * from './raster';
export * from './receipt-thermal';
export * from './bluetooth';
export * from './print-thermal';

/** True hanya di browser yang punya Web Bluetooth (Chrome/Edge Android & desktop). */
export const isWebBluetoothAvailable = (): boolean =>
  typeof navigator !== 'undefined' && !!(navigator as { bluetooth?: unknown }).bluetooth;
