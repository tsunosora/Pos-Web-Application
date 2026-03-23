import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    // All mutating pages are "use client" — only localStorage matters
    let token: string | null = null;
    if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});


// Categories
export const getCategories = async () => (await api.get('/categories')).data;
export const createCategory = async (data: { name: string }) => (await api.post('/categories', data)).data;
export const updateCategory = async (id: number, data: { name: string }) => (await api.patch(`/categories/${id}`, data)).data;
export const deleteCategory = async (id: number) => (await api.delete(`/categories/${id}`)).data;

// Units
export const getUnits = async () => (await api.get('/units')).data;
export const createUnit = async (data: { name: string }) => (await api.post('/units', data)).data;
export const updateUnit = async (id: number, data: { name: string }) => (await api.patch(`/units/${id}`, data)).data;
export const deleteUnit = async (id: number) => (await api.delete(`/units/${id}`)).data;

// Invoices & Quotations
export const getInvoices = async (type?: 'INVOICE' | 'QUOTATION') => (await api.get(type ? `/invoices?type=${type}` : '/invoices')).data;
export const getInvoiceById = async (id: number) => (await api.get(`/invoices/${id}`)).data;
export const createInvoice = async (data: any) => (await api.post('/invoices', data)).data;
export const updateInvoice = async (id: number, data: any) => (await api.patch(`/invoices/${id}`, data)).data;
export const updateInvoiceStatus = async (id: number, status: string) => (await api.patch(`/invoices/${id}/status`, { status })).data;
export const convertQuotationToInvoice = async (id: number) => (await api.post(`/invoices/${id}/convert-to-invoice`, {})).data;
export const deleteInvoice = async (id: number) => (await api.delete(`/invoices/${id}`)).data;

// HPP Calculator
export const getHppWorksheets = async (variantId?: number) =>
    (await api.get('/hpp', { params: variantId ? { variantId } : undefined })).data;
export const getHppWorksheetById = async (id: number) => (await api.get(`/hpp/${id}`)).data;
export const getHppWorksheetsByVariant = async (variantId: number) => (await api.get(`/hpp/by-variant/${variantId}`)).data;
export const createHppWorksheet = async (data: any) => (await api.post('/hpp', data)).data;
export const updateHppWorksheet = async (id: number, data: any) => (await api.patch(`/hpp/${id}`, data)).data;
export const applyHppToVariant = async (worksheetId: number, hppPerUnit: number) =>
    (await api.post(`/hpp/${worksheetId}/apply-to-variant`, { hppPerUnit })).data;
export const applyHppToVariants = async (worksheetId: number, variantIds: number[], hppPerUnit: number) =>
    (await api.post(`/hpp/${worksheetId}/apply-to-variants`, { variantIds, hppPerUnit })).data;
export const applyHppVariantsCustom = async (
    worksheetId: number,
    variants: { variantId: number; hppPerUnit: number; scaleFactor: number }[]
) => (await api.post(`/hpp/${worksheetId}/apply-variants-custom`, { variants })).data;
export const deleteHppWorksheet = async (id: number) => (await api.delete(`/hpp/${id}`)).data;
export const getHppWorksheetByProduct = async (productId: number) => (await api.get(`/hpp/by-product/${productId}`)).data;

// Bulk Import
export const bulkImportProducts = async (data: { products: any[] }) =>
    (await api.post('/products/bulk-import', data)).data;

// Backup & Recovery
export const getBackupGroups = async () => (await api.get('/backup/groups')).data;
export const previewBackupFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return (await api.post('/backup/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const exportBackup = async (groups: string[], includeImages = true): Promise<Blob> => {
    const res = await api.post('/backup/export', { groups, includeImages }, { responseType: 'blob' });
    return res.data;
};
export const restoreBackup = async (file: File, mode: 'skip' | 'overwrite', tables?: string[]) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    if (tables && tables.length > 0) formData.append('tables', tables.join(','));
    return (await api.post('/backup/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};

// Products
export const getProducts = async () => (await api.get('/products')).data;
export const getProduct = async (id: number) => (await api.get(`/products/${id}`)).data;
export const createProduct = async (data: any) => (await api.post('/products', data)).data;
export const updateProduct = async (id: number, data: any) => (await api.patch(`/products/${id}`, data)).data;
export const deleteProduct = async (id: number) => (await api.delete(`/products/${id}`)).data;
export const bulkDeleteProducts = async (ids: number[]) => (await api.delete('/products/bulk', { data: { ids } })).data;

export const uploadProductImage = async (id: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return (await api.post(`/products/${id}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const uploadProductImages = async (id: number, files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    return (await api.post(`/products/${id}/upload-images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

// Variants
export const addProductVariant = async (productId: number, data: any) => (await api.post(`/products/${productId}/variants`, data)).data;
export const updateProductVariant = async (variantId: number, data: any) => (await api.patch(`/products/variants/${variantId}`, data)).data;
export const deleteProductVariant = async (variantId: number) => (await api.delete(`/products/variants/${variantId}`)).data;

export const uploadVariantImage = async (variantId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return (await api.post(`/products/variants/${variantId}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

// Ingredients (product-level)
export const addIngredient = async (productId: number, data: { name: string; quantity: number; unit: string }) =>
    (await api.post(`/products/${productId}/ingredients`, data)).data;
export const updateIngredient = async (productId: number, ingId: number, data: any) =>
    (await api.patch(`/products/${productId}/ingredients/${ingId}`, data)).data;
export const deleteIngredient = async (productId: number, ingId: number) =>
    (await api.delete(`/products/${productId}/ingredients/${ingId}`)).data;

// Variant Price Tiers
export const getVariantPriceTiers = async (variantId: number) =>
    (await api.get(`/products/variants/${variantId}/price-tiers`)).data;
export const replaceVariantPriceTiers = async (variantId: number, tiers: any[]) =>
    (await api.put(`/products/variants/${variantId}/price-tiers`, { tiers })).data;
export const deleteVariantPriceTier = async (variantId: number, tierId: number) =>
    (await api.delete(`/products/variants/${variantId}/price-tiers/${tierId}`)).data;

// Variant Ingredients (variant-level BOM)
export const getVariantIngredients = async (variantId: number) =>
    (await api.get(`/products/variants/${variantId}/variant-ingredients`)).data;
export const replaceVariantIngredients = async (variantId: number, ingredients: any[]) =>
    (await api.put(`/products/variants/${variantId}/variant-ingredients`, { ingredients })).data;
export const deleteVariantIngredient = async (variantId: number, ingId: number) =>
    (await api.delete(`/products/variants/${variantId}/variant-ingredients/${ingId}`)).data;

// Stock Movements
export const getStockMovements = async () => (await api.get('/stock-movements')).data;
export const logStockMovement = async (data: { productVariantId: number; type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string }) => {
    return (await api.post('/stock-movements', data)).data;
};

// Batches
export const getBatches = async () => (await api.get('/batches')).data;
export const createBatch = async (data: any) => (await api.post('/batches', data)).data;

// Reports
export const getDashboardMetrics = async () => (await api.get('/transactions/dashboard/metrics')).data;
export const getSalesChart = async (period: string) => (await api.get(`/transactions/dashboard/chart?period=${period}`)).data;
export const getSalesSummary = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/transactions/reports/summary?${params.toString()}`)).data;
};
export const getProfitReport = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/reports/profit?${params.toString()}`)).data;
};

// Branches
export const getBranches = async () => (await api.get('/branches')).data;
export const createBranch = async (data: any) => (await api.post('/branches', data)).data;
export const updateBranch = async (id: number, data: any) => (await api.patch(`/branches/${id}`, data)).data;
export const deleteBranch = async (id: number) => (await api.delete(`/branches/${id}`)).data;

// Competitors
export const getCompetitors = async () => (await api.get('/competitors')).data;
export const createCompetitor = async (data: any) => (await api.post('/competitors', data)).data;
export const updateCompetitor = async (id: number, data: any) => (await api.patch(`/competitors/${id}`, data)).data;
export const deleteCompetitor = async (id: number) => (await api.delete(`/competitors/${id}`)).data;

// Cashflow
export const getCashflows = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/cashflow?${params.toString()}`)).data;
};
export const createCashflow = async (data: any) => (await api.post('/cashflow', data)).data;
export const updateCashflow = async (id: number, data: any) => (await api.patch(`/cashflow/${id}`, data)).data;
export const deleteCashflow = async (id: number) => (await api.delete(`/cashflow/${id}`)).data;
export const getCashflowMonthlyTrend = async () => (await api.get('/cashflow/monthly-trend')).data;
export const getCashflowCategoryBreakdown = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/cashflow/category-breakdown?${params.toString()}`)).data;
};


// Users & Roles
export const getUsers = async () => (await api.get('/users')).data;
export const createUser = async (data: any) => (await api.post('/users', data)).data;
export const updateUser = async (id: number, data: { name?: string, roleId?: number, phone?: string, password?: string }) => (await api.patch(`/users/${id}`, data)).data;
export const deleteUser = async (id: number) => (await api.delete(`/users/${id}`)).data;

export const getRoles = async () => (await api.get('/users/roles')).data;
export const createRole = async (data: { name: string }) => (await api.post('/users/roles', data)).data;
export const updateRole = async (id: number, data: { name: string }) => (await api.patch(`/users/roles/${id}`, data)).data;
export const deleteRole = async (id: number) => (await api.delete(`/users/roles/${id}`)).data;

// Store Settings
export const getSettings = async () => (await api.get('/settings')).data;
export const updateSettings = async (data: any) => (await api.patch('/settings', data)).data;
export const getPublicSettings = async () => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/settings/public`, { cache: 'no-store' });
    return res.json();
};
export const uploadLoginBgImage = async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return (await api.post('/settings/upload-login-bg', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const uploadQrisImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return (await api.post('/settings/upload-qris', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};
export const uploadLogoImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return (await api.post('/settings/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

// Transactions
export const getTransactions = async () => (await api.get('/transactions')).data;
export const getTransactionById = async (id: number) => (await api.get(`/transactions/${id}`)).data;
export const createTransaction = async (data: any) => (await api.post('/transactions', data)).data;
export const payOffTransaction = async (id: number, data: { paymentMethod: string, bankAccountId?: number }) => (await api.post(`/transactions/${id}/pay-off`, data)).data;

// Bank Accounts
export const getBankAccounts = async () => (await api.get('/bank-accounts')).data;
export const createBankAccount = async (data: any) => (await api.post('/bank-accounts', data)).data;
export const updateBankAccount = async (id: number, data: any) => (await api.patch(`/bank-accounts/${id}`, data)).data;
export const deleteBankAccount = async (id: number) => (await api.delete(`/bank-accounts/${id}`)).data;
export const resetBankBalance = async (id: number, newBalance: number) =>
    (await api.patch(`/bank-accounts/${id}/reset-balance`, { newBalance })).data;

// Customers
export const getCustomers = async () => (await api.get('/customers')).data;
export const getCustomersWithStats = async () => (await api.get('/customers/with-stats')).data;
export const getCustomerAnalytics = async (id: number) => (await api.get(`/customers/${id}/analytics`)).data;
export const getCustomersExportData = async () => (await api.get('/customers/export-data')).data;
export const createCustomer = async (data: { name: string, phone?: string, address?: string }) => (await api.post('/customers', data)).data;
export const updateCustomer = async (id: number, data: { name?: string, phone?: string, address?: string }) => (await api.patch(`/customers/${id}`, data)).data;
export const deleteCustomer = async (id: number) => (await api.delete(`/customers/${id}`)).data;

// Reports
export const getShiftExpectations = async () => (await api.get('/reports/current-shift')).data;
export const getStaffList = async () => (await api.get('/reports/staff-list')).data;
export const closeShift = async (formData: FormData) => (await api.post('/reports/close-shift', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
})).data;

// WhatsApp Bot
export const getWhatsappStatus = async () => (await api.get('/whatsapp/status')).data;
export const getWhatsappConfig = async () => (await api.get('/whatsapp/config')).data;
export const getWhatsappGroups = async () => (await api.get('/whatsapp/groups')).data;
export const logoutWhatsapp = async () => (await api.post('/whatsapp/logout')).data;
export const sendWhatsappToGroup = async (groupId: string, message: string) =>
    (await api.post('/whatsapp/send', { groupId, message })).data;
export const broadcastWhatsapp = async (message: string) =>
    (await api.post('/whatsapp/broadcast', { message })).data;
export const sendWhatsappAnnouncement = async (message: string) =>
    (await api.post('/whatsapp/announce', { message })).data;
export const updateWhatsappBroadcastGroups = async (data: { add?: string; remove?: string }) =>
    (await api.post('/whatsapp/config/broadcast-groups', data)).data;
export const setWhatsappAnnouncement = async (channelId: string | null) =>
    (await api.post('/whatsapp/config/announcement', { channelId })).data;

// Stock Opname — Admin
export const startOpnameSession = async (data: { notes?: string; categoryId?: number; expiresHours?: number }) =>
    (await api.post('/stock-opname/sessions', data)).data;
export const getOpnameSessions = async () => (await api.get('/stock-opname/sessions')).data;
export const getOpnameSessionDetail = async (id: string) => (await api.get(`/stock-opname/sessions/${id}`)).data;
export const cancelOpnameSession = async (id: string) => (await api.patch(`/stock-opname/sessions/${id}/cancel`)).data;
export const finishOpnameSession = async (id: string, confirmedItems: { productVariantId: number; confirmedStock: number }[]) =>
    (await api.post(`/stock-opname/sessions/${id}/finish`, { confirmedItems })).data;

// Stock Opname — Public (operator, tanpa auth)
export const verifyOpnameToken = async (token: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/stock-opname/public/${token}/verify`);
    if (!res.ok) throw new Error((await res.json()).message || 'Link tidak valid');
    return res.json();
};
export const getOpnameProducts = async (token: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/stock-opname/public/${token}/products`);
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal memuat produk');
    return res.json();
};
export const submitOpnameItems = async (
    token: string,
    data: { operatorName: string; items: { productVariantId: number; actualStock: number }[] },
) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/stock-opname/public/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal menyimpan');
    return res.json();
};

// Production Queue (public — no JWT)
const API_BASE_PROD = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const verifyOperatorPin = async (pin: string): Promise<{ valid: boolean; message?: string }> => {
    const res = await fetch(`${API_BASE_PROD()}/production/pin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
    });
    return res.json();
};

export const getProductionJobs = async (status?: string): Promise<any[]> => {
    const url = status
        ? `${API_BASE_PROD()}/production/jobs?status=${status}`
        : `${API_BASE_PROD()}/production/jobs`;
    const res = await fetch(url);
    return res.json();
};

export const getProductionRolls = async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE_PROD()}/production/rolls`);
    return res.json();
};

export const getProductionStats = async (): Promise<{ antrian: number; proses: number; menungguPasang: number; pasang: number; selesai: number }> => {
    const res = await fetch(`${API_BASE_PROD()}/production/stats`);
    return res.json();
};

export const startProductionJob = async (id: number, data: {
    rollVariantId?: number;
    usedWaste: boolean;
    rollAreaM2?: number;
    operatorNote?: string;
}): Promise<any> => {
    const res = await fetch(`${API_BASE_PROD()}/production/jobs/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal memulai job');
    return res.json();
};

export const completeProductionJob = async (id: number, operatorNote?: string): Promise<any> => {
    const res = await fetch(`${API_BASE_PROD()}/production/jobs/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorNote }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal menyelesaikan job');
    return res.json();
};

export const pickupProductionJob = async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE_PROD()}/production/jobs/${id}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal pickup job');
    return res.json();
};

export const startAssemblyJob = async (id: number, assemblyNote?: string): Promise<any> => {
    const res = await fetch(`${API_BASE_PROD()}/production/jobs/${id}/start-assembly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assemblyNote }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal memulai pemasangan');
    return res.json();
};

export const completeAssemblyJob = async (id: number, assemblyNote?: string): Promise<any> => {
    const res = await fetch(`${API_BASE_PROD()}/production/jobs/${id}/complete-assembly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assemblyNote }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal menyelesaikan pemasangan');
    return res.json();
};

export const createProductionBatch = async (data: {
    jobIds: number[];
    rollVariantId?: number;
    usedWaste: boolean;
    totalAreaM2?: number;
}): Promise<any> => {
    const res = await fetch(`${API_BASE_PROD()}/production/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal membuat batch');
    return res.json();
};

export const completeProductionBatch = async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE_PROD()}/production/batches/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal menyelesaikan batch');
    return res.json();
};

// Suppliers
export const getSuppliers = async () => (await api.get('/suppliers')).data;
export const getSupplier = async (id: number) => (await api.get(`/suppliers/${id}`)).data;
export const createSupplier = async (data: any) => (await api.post('/suppliers', data)).data;
export const updateSupplier = async (id: number, data: any) => (await api.patch(`/suppliers/${id}`, data)).data;
export const deleteSupplier = async (id: number) => (await api.delete(`/suppliers/${id}`)).data;
export const addSupplierItem = async (supplierId: number, data: any) => (await api.post(`/suppliers/${supplierId}/items`, data)).data;
export const updateSupplierItem = async (itemId: number, data: any) => (await api.patch(`/suppliers/items/${itemId}`, data)).data;
export const deleteSupplierItem = async (itemId: number) => (await api.delete(`/suppliers/items/${itemId}`)).data;

export default api;

