// Shared types, constants, and helpers for the invoices feature

export type DocType = "INVOICE" | "QUOTATION";
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "CANCELLED" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export type InvoiceItem = {
    id?: number;
    description: string;
    unit: string;
    quantity: number;
    price: number;
    // Area-based (banner/spanduk): quantity = width × height
    isAreaBased?: boolean;
    width?: number;
    height?: number;
};

export type Invoice = {
    id: number;
    invoiceNumber: string;
    type: DocType;
    clientName: string;
    clientCompany?: string;
    clientAddress?: string;
    clientPhone?: string;
    clientEmail?: string;
    date: string;
    dueDate?: string;
    validUntil?: string;
    status: InvoiceStatus;
    subtotal: string;
    taxRate: string;
    taxAmount: string;
    discount: string;
    total: string;
    notes?: string;
    items: InvoiceItem[];
};

export const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
    DRAFT:     { label: "Draft",      className: "bg-muted text-muted-foreground" },
    SENT:      { label: "Terkirim",   className: "bg-blue-500/10 text-blue-500" },
    PAID:      { label: "Lunas",      className: "bg-emerald-500/10 text-emerald-600" },
    CANCELLED: { label: "Dibatalkan", className: "bg-destructive/10 text-destructive" },
    ACCEPTED:  { label: "Diterima",   className: "bg-emerald-500/10 text-emerald-600" },
    REJECTED:  { label: "Ditolak",    className: "bg-destructive/10 text-destructive" },
    EXPIRED:   { label: "Kedaluarsa", className: "bg-orange-500/10 text-orange-500" },
};

export const INVOICE_NEXT_STATUSES: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
    DRAFT: ["SENT"],
    SENT:  ["PAID", "CANCELLED"],
};

export const QUOTATION_NEXT_STATUSES: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
    DRAFT: ["SENT"],
    SENT:  ["ACCEPTED", "REJECTED"],
};

export function calcTotals(items: InvoiceItem[], taxRate: number, discount: number) {
    const subtotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const taxAmount = Math.round(subtotal * taxRate / 100);
    const total = subtotal + taxAmount - discount;
    return { subtotal, taxAmount, total };
}
