"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSuppliers,
  getProducts,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  addSupplierItem,
  updateSupplierItem,
  deleteSupplierItem,
} from "@/lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  Package,
  X,
  Search,
  User,
  FileText,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProductVariant {
  id: number;
  sku: string;
  variantName: string | null;
  price: number;
  product: {
    id: number;
    name: string;
  };
}

interface SupplierItem {
  id: number;
  supplierId: number;
  productVariantId: number;
  purchasePrice: number;
  notes: string | null;
  productVariant: ProductVariant;
}

interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  items: SupplierItem[];
}

interface Product {
  id: number;
  name: string;
  variants: ProductVariant[];
}

// ── SupplierFormModal ────────────────────────────────────────────────────────

interface SupplierFormModalProps {
  supplier?: Supplier | null;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}

function SupplierFormModal({ supplier, onClose, onSave, isSaving }: SupplierFormModalProps) {
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contactPerson: supplier?.contactPerson ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    notes: supplier?.notes ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: form.name,
      contactPerson: form.contactPerson || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {supplier ? "Edit Supplier" : "Tambah Supplier"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Nama Supplier <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: PT. Maju Jaya"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Kontak Person
            </label>
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="Nama PIC / sales"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                No. Telp
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="08xx-xxxx-xxxx"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="supplier@email.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Alamat
            </label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Jl. Raya No. 1, Kota..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Catatan
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Catatan tambahan..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ItemFormModal ─────────────────────────────────────────────────────────────

interface ItemFormModalProps {
  item?: SupplierItem | null;
  products: Product[];
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}

function ItemFormModal({ item, products, onClose, onSave, isSaving }: ItemFormModalProps) {
  const [variantSearch, setVariantSearch] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    item?.productVariantId ?? null
  );
  const [purchasePrice, setPurchasePrice] = useState(
    item?.purchasePrice ? String(item.purchasePrice) : ""
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Flatten all variants from all products for search
  const allVariants: { variant: ProductVariant; productName: string }[] = products.flatMap(
    (p) =>
      (p.variants || []).map((v) => ({
        variant: v,
        productName: p.name,
      }))
  );

  const filtered = allVariants.filter(({ variant, productName }) => {
    const q = variantSearch.toLowerCase();
    return (
      productName.toLowerCase().includes(q) ||
      variant.sku.toLowerCase().includes(q) ||
      (variant.variantName ?? "").toLowerCase().includes(q)
    );
  });

  const selectedEntry = allVariants.find((e) => e.variant.id === selectedVariantId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) return;
    onSave({
      productVariantId: selectedVariantId,
      purchasePrice: parseFloat(purchasePrice) || 0,
      notes: notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {item ? "Edit Barang Supplier" : "Tambah Barang"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Variant picker */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Varian Produk <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <span className={selectedEntry ? "text-foreground" : "text-muted-foreground"}>
                  {selectedEntry
                    ? `${selectedEntry.productName}${selectedEntry.variant.variantName ? " — " + selectedEntry.variant.variantName : ""} (${selectedEntry.variant.sku})`
                    : "Pilih varian produk..."}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        autoFocus
                        type="text"
                        value={variantSearch}
                        onChange={(e) => setVariantSearch(e.target.value)}
                        placeholder="Cari produk atau SKU..."
                        className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Tidak ada produk ditemukan
                      </p>
                    ) : (
                      filtered.slice(0, 50).map(({ variant, productName }) => (
                        <button
                          key={variant.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedVariantId(variant.id);
                            setDropdownOpen(false);
                            setVariantSearch("");
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between ${
                            selectedVariantId === variant.id ? "bg-accent" : ""
                          }`}
                        >
                          <span>
                            <span className="font-medium text-foreground">{productName}</span>
                            {variant.variantName && (
                              <span className="text-muted-foreground"> — {variant.variantName}</span>
                            )}
                            <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {variant.sku}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Purchase price */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Harga Beli (Rp) <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              required
              min={0}
              step="any"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Catatan
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || !selectedVariantId}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── DetailModal ───────────────────────────────────────────────────────────────

interface DetailModalProps {
  supplier: Supplier;
  products: Product[];
  onClose: () => void;
  onEditSupplier: (s: Supplier) => void;
}

function DetailModal({ supplier, products, onClose, onEditSupplier }: DetailModalProps) {
  const qc = useQueryClient();
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<SupplierItem | null>(null);

  const addItemMutation = useMutation({
    mutationFn: (data: any) => addSupplierItem(supplier.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setAddItemOpen(false);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateSupplierItem(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setEditItem(null);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => deleteSupplierItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  // Get the latest data from cache (after mutations)
  const suppliersData: Supplier[] = qc.getQueryData(["suppliers"]) ?? [];
  const latestSupplier = suppliersData.find((s) => s.id === supplier.id) ?? supplier;

  const handleDeleteItem = (id: number) => {
    if (confirm("Hapus item ini dari daftar supplier?")) {
      deleteItemMutation.mutate(id);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{latestSupplier.name}</h2>
              <p className="text-sm text-muted-foreground">Detail & Daftar Barang</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditSupplier(latestSupplier)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors ml-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Supplier info */}
          <div className="px-6 py-4 border-b border-border bg-muted/30 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {latestSupplier.contactPerson && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4 shrink-0" />
                  <span>{latestSupplier.contactPerson}</span>
                </div>
              )}
              {latestSupplier.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{latestSupplier.phone}</span>
                </div>
              )}
              {latestSupplier.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>{latestSupplier.email}</span>
                </div>
              )}
              {latestSupplier.address && (
                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{latestSupplier.address}</span>
                </div>
              )}
              {latestSupplier.notes && (
                <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                  <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{latestSupplier.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                Daftar Barang ({latestSupplier.items.length})
              </h3>
              <button
                onClick={() => setAddItemOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Barang
              </button>
            </div>

            {latestSupplier.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Belum ada barang</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Klik "Tambah Barang" untuk menghubungkan produk dengan supplier ini
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Produk</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">SKU</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Harga Beli</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Catatan</th>
                      <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {latestSupplier.items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {item.productVariant.product.name}
                          {item.productVariant.variantName && (
                            <span className="text-muted-foreground font-normal">
                              {" — "}{item.productVariant.variantName}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-muted-foreground">
                            {item.productVariant.sku}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          Rp {Number(item.purchasePrice).toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[150px] truncate">
                          {item.notes ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setEditItem(item)}
                              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {addItemOpen && (
        <ItemFormModal
          products={products}
          onClose={() => setAddItemOpen(false)}
          onSave={(data) => addItemMutation.mutate(data)}
          isSaving={addItemMutation.isPending}
        />
      )}

      {/* Edit Item Modal */}
      {editItem && (
        <ItemFormModal
          item={editItem}
          products={products}
          onClose={() => setEditItem(null)}
          onSave={(data) => updateItemMutation.mutate({ id: editItem.id, data })}
          isSaving={updateItemMutation.isPending}
        />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [formModal, setFormModal] = useState<{ open: boolean; supplier?: Supplier | null }>({
    open: false,
    supplier: null,
  });
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: getSuppliers,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setFormModal({ open: false });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateSupplier(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setFormModal({ open: false });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  const handleSaveSupplier = (data: any) => {
    if (formModal.supplier) {
      updateMutation.mutate({ id: formModal.supplier.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteSupplier = (s: Supplier) => {
    if (
      confirm(
        `Hapus supplier "${s.name}"? Semua data barang supplier ini juga akan dihapus.`
      )
    ) {
      if (detailSupplier?.id === s.id) setDetailSupplier(null);
      deleteMutation.mutate(s.id);
    }
  };

  const getMatchedItems = (s: Supplier, q: string): SupplierItem[] => {
    if (!q) return [];
    return s.items.filter((item) =>
      item.productVariant.product.name.toLowerCase().includes(q) ||
      (item.productVariant.variantName ?? "").toLowerCase().includes(q) ||
      item.productVariant.sku.toLowerCase().includes(q)
    );
  };

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const matchesSupplier =
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson ?? "").toLowerCase().includes(q) ||
      (s.phone ?? "").toLowerCase().includes(q);
    return matchesSupplier || getMatchedItems(s, q).length > 0;
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Supplier</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola daftar supplier dan harga beli per produk
          </p>
        </div>
        <button
          onClick={() => setFormModal({ open: true, supplier: null })}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Supplier
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama supplier, kontak, atau nama bahan..."
          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-base font-medium text-muted-foreground">
            {search ? `Tidak ada supplier yang menyediakan "${search}"` : "Belum ada supplier"}
          </p>
          {!search && (
            <p className="text-sm text-muted-foreground/70 mt-1">
              Klik "Tambah Supplier" untuk memulai
            </p>
          )}
        </div>
      )}

      {/* Supplier cards grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((supplier) => (
            <div
              key={supplier.id}
              className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-5">
                {/* Top row: name + item badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-base truncate">
                      {supplier.name}
                    </h3>
                    {supplier.contactPerson && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">
                          {supplier.contactPerson}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Package className="h-3 w-3" />
                    {supplier.items.length} item
                  </span>
                </div>

                {/* Contact info pills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {supplier.phone && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {supplier.phone}
                    </span>
                  )}
                  {supplier.email && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground truncate max-w-[180px]">
                      <Mail className="h-3 w-3 shrink-0" />
                      {supplier.email}
                    </span>
                  )}
                  {supplier.address && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground truncate max-w-[200px]">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {supplier.address}
                    </span>
                  )}
                </div>

                {/* Matched items preview — tampil saat search aktif dan cocok dari produk */}
                {search && (() => {
                  const matched = getMatchedItems(supplier, search.toLowerCase());
                  if (matched.length === 0) return null;
                  return (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground">Menyediakan:</span>
                      {matched.slice(0, 4).map((item) => (
                        <span key={item.id} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          {item.productVariant.product.name}
                          {item.productVariant.variantName && ` — ${item.productVariant.variantName}`}
                        </span>
                      ))}
                      {matched.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{matched.length - 4} lainnya</span>
                      )}
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailSupplier(supplier)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Lihat Barang
                  </button>
                  <button
                    onClick={() => setFormModal({ open: true, supplier })}
                    className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Edit supplier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(supplier)}
                    className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                    title="Hapus supplier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier Form Modal */}
      {formModal.open && (
        <SupplierFormModal
          supplier={formModal.supplier}
          onClose={() => setFormModal({ open: false })}
          onSave={handleSaveSupplier}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Detail Modal */}
      {detailSupplier && (
        <DetailModal
          supplier={detailSupplier}
          products={products}
          onClose={() => setDetailSupplier(null)}
          onEditSupplier={(s) => {
            setDetailSupplier(null);
            setFormModal({ open: true, supplier: s });
          }}
        />
      )}
    </div>
  );
}
