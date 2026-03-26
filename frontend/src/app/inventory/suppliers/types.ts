// Shared types for the suppliers feature

export interface ProductVariant {
  id: number;
  sku: string;
  variantName: string | null;
  price: number;
  product: {
    id: number;
    name: string;
  };
}

export interface SupplierItem {
  id: number;
  supplierId: number;
  productVariantId: number;
  purchasePrice: number;
  notes: string | null;
  productVariant: ProductVariant;
}

export interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  items: SupplierItem[];
}

export interface Product {
  id: number;
  name: string;
  variants: ProductVariant[];
}
