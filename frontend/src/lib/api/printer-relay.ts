// frontend/src/lib/api/printer-relay.ts
// Helper API untuk print relay: manajemen printer per cabang + kirim job cetak.
import api from './client';

export interface PrinterDeviceDTO {
    id: number;
    branchId: number;
    name: string;
    connection: string; // "usb" | "bluetooth"
    mode: string; // com | rfcomm | ble
    target: string | null;
    isActive: boolean;
    token: string; // hanya terlihat oleh Owner (untuk setup agen)
    online: boolean;
    lastSeenAt: string | null;
}

export interface RelayStatus {
    branchId: number | null;
    online: boolean;
    lastSeenAt: number | null;
}

export const listPrinterDevices = (branchId?: number) =>
    api
        .get<PrinterDeviceDTO[]>('/printer-relay/devices', {
            params: branchId != null ? { branchId } : undefined,
        })
        .then((r) => r.data);

export const createPrinterDevice = (payload: {
    branchId: number;
    name: string;
    connection: string;
    target?: string | null;
}) => api.post<PrinterDeviceDTO>('/printer-relay/devices', payload).then((r) => r.data);

export const updatePrinterDevice = (
    id: number,
    payload: Partial<{ name: string; connection: string; target: string | null; isActive: boolean }>,
) => api.patch<PrinterDeviceDTO>(`/printer-relay/devices/${id}`, payload).then((r) => r.data);

export const rotatePrinterToken = (id: number) =>
    api.post<PrinterDeviceDTO>(`/printer-relay/devices/${id}/rotate-token`).then((r) => r.data);

export const deletePrinterDevice = (id: number) =>
    api.delete(`/printer-relay/devices/${id}`).then((r) => r.data);

export const getRelayStatus = () =>
    api.get<RelayStatus>('/printer-relay/status').then((r) => r.data);
