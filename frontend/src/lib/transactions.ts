import api from './api';

export const createTransaction = async (data: {
    items: {
        productVariantId: number;
        quantity: number;
        widthCm?: number;
        heightCm?: number;
        unitType?: string;
        note?: string;
    }[];
    paymentMethod: 'CASH' | 'QRIS' | 'BANK_TRANSFER';
    discount?: number;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
}) => {
    return (await api.post('/transactions', data)).data;
};

