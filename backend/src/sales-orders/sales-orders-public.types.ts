export interface CreateSalesOrderPayload {
    customerId?: number | null;
    customerName: string;
    customerPhone?: string | null;
    customerAddress?: string | null;
    designerName?: string; // akan diisi dari Designer.name jika via public endpoint
    notes?: string | null;
    deadline?: string | null;
    items: {
        productVariantId: number;
        quantity: number;
        widthCm?: number | null;
        heightCm?: number | null;
        unitType?: string | null;
        pcs?: number | null;
        customPrice?: number | null;
        note?: string | null;
    }[];
}
