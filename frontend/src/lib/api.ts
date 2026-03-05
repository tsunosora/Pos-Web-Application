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

// Invoices
export const getInvoices = async () => (await api.get('/invoice')).data;
export const getInvoiceById = async (id: number) => (await api.get(`/invoice/${id}`)).data;
export const createInvoice = async (data: any) => (await api.post('/invoice', data)).data;
export const updateInvoiceStatus = async (id: number, status: 'SENT' | 'PAID' | 'CANCELLED') => (await api.patch(`/invoice/${id}/status`, { status })).data;
export const deleteInvoice = async (id: number) => (await api.delete(`/invoice/${id}`)).data;

// HPP Calculator
export const getHppWorksheets = async () => (await api.get('/hpp')).data;
export const getHppWorksheetById = async (id: number) => (await api.get(`/hpp/${id}`)).data;
export const createHppWorksheet = async (data: any) => (await api.post('/hpp', data)).data;
export const updateHppWorksheet = async (id: number, data: any) => (await api.patch(`/hpp/${id}`, data)).data;
export const deleteHppWorksheet = async (id: number) => (await api.delete(`/hpp/${id}`)).data;

// Products
export const getProducts = async () => (await api.get('/products')).data;
export const getProduct = async (id: number) => (await api.get(`/products/${id}`)).data;
export const createProduct = async (data: any) => (await api.post('/products', data)).data;
export const updateProduct = async (id: number, data: any) => (await api.patch(`/products/${id}`, data)).data;
export const deleteProduct = async (id: number) => (await api.delete(`/products/${id}`)).data;

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

// Ingredients
export const addIngredient = async (productId: number, data: { name: string; quantity: number; unit: string }) =>
    (await api.post(`/products/${productId}/ingredients`, data)).data;
export const updateIngredient = async (productId: number, ingId: number, data: any) =>
    (await api.patch(`/products/${productId}/ingredients/${ingId}`, data)).data;
export const deleteIngredient = async (productId: number, ingId: number) =>
    (await api.delete(`/products/${productId}/ingredients/${ingId}`)).data;

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
export const getSalesSummary = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/transactions/reports/summary?${params.toString()}`)).data;
};

// Branches for Profit Map
export const getBranches = async () => (await api.get('/branches')).data;

// Cashflow
export const getCashflows = async () => (await api.get('/cashflow')).data;
export const createCashflow = async (data: any) => (await api.post('/cashflow', data)).data;


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
export const logoutWhatsapp = async () => (await api.post('/whatsapp/logout')).data;

export default api;
