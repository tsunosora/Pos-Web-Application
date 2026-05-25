import { LeadLevel, LeadSource, LeadStatus } from '@prisma/client';

export class LeadItemDto {
    productVariantId?: number | null;
    description!: string;
    quantity!: number;
    unitPrice!: number;
    widthCm?: number;
    heightCm?: number;
    unitType?: string;
    note?: string;
}

export class CreateLeadDto {
    name!: string;
    phone?: string;
    source!: LeadSource;
    sourceDetail?: string;
    level?: LeadLevel;
    needs?: string;
    estimatedValue?: number;
    city?: string;
    assignedToId?: number;
    followUpDate?: string; // ISO date
    deliveryDeadline?: string; // ISO date — tanggal kirim deadline
    status?: LeadStatus;   // optional override (default NEW)
    imageUrl?: string;     // DEPRECATED — pakai imageUrls. Tetap di-accept untuk backward compat.
    imageUrls?: string[];  // multi-image (urutan = posisi di slider)
    items?: LeadItemDto[]; // produk yang ingin di-order
}

export class UpdateLeadDto {
    name?: string;
    phone?: string;
    source?: LeadSource;
    sourceDetail?: string;
    level?: LeadLevel;
    needs?: string;
    estimatedValue?: number;
    city?: string;
    assignedToId?: number | null;
    followUpDate?: string | null;
    deliveryDeadline?: string | null;
    firstResponseAt?: string | null; // manual override response time
    status?: LeadStatus;
    imageUrl?: string | null;
    imageUrls?: string[];  // kalau di-set, replace semua images existing
    items?: LeadItemDto[]; // kalau di-set, replace semua items existing
}

export class CreateActivityDto {
    kind!: string;       // FIRST_CONTACT, MESSAGE, CALL, MEETING, PROPOSAL_SENT, NOTE, dll
    text?: string;
    meta?: Record<string, unknown>;
}

export class ConvertLeadDto {
    // Pilihan: pakai customer existing ATAU buat baru
    customerId?: number;             // kalau pilih existing
    createCustomer?: boolean;        // kalau true & customerId kosong → buat customer baru pakai data lead
    // Pilihan dokumen yang dibuat otomatis (boleh pilih lebih dari satu)
    createSalesOrderDraft?: boolean; // SPK: Sales Order production-bound (SO-...)
    designerName?: string;           // designer untuk SO (atau pakai default 'TBD')
    createInvoiceDraft?: boolean;    // Invoice: nota tagihan (INV-...)
    invoiceType?: 'INVOICE' | 'QUOTATION'; // default INVOICE; kalau QUOTATION → nomor SPH-...
    notes?: string;                  // catatan ekstra (di-shared antara SO & Invoice)
    // Default: true. Set false untuk skip auto-create Transaction (PENDING) yang spawn
    // production jobs. Kalau ada lead items dengan productVariantId & flag ini tidak
    // false, Transaction PENDING dibuat otomatis → production pipeline langsung jalan.
    createProductionTransaction?: boolean;
    // Payment options saat convert. Default: NONE (Transaction PENDING tanpa pembayaran).
    paymentMode?: 'NONE' | 'DP' | 'LUNAS';
    paymentMethod?: 'CASH' | 'TRANSFER' | 'QRIS';
    paymentAmount?: number;   // hanya untuk DP. LUNAS auto = grandTotal.
    bankAccountId?: number;   // wajib untuk TRANSFER (rekening tujuan)
}

export class CloseLostDto {
    reason!: string;
}
