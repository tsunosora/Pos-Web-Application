"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSuppliers, getProducts, createSupplier, updateSupplier, deleteSupplier } from "@/lib/api";
import { Plus, Pencil, Trash2, ChevronDown, Phone, Mail, MapPin, Package, Search, User } from "lucide-react";
import { Supplier, SupplierItem, Product } from "./types";
import { SupplierFormModal } from "./SupplierFormModal";
import { DetailModal } from "./DetailModal";

export default function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [formModal, setFormModal] = useState<{ open: boolean; supplier?: Supplier | null }>({ open: false, supplier: null });
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); setFormModal({ open: false }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateSupplier(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); setFormModal({ open: false }); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); },
  });

  const handleSaveSupplier = (data: any) => {
    if (formModal.supplier) {
      updateMutation.mutate({ id: formModal.supplier.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteSupplier = (s: Supplier) => {
    if (confirm(`Hapus supplier "${s.name}"? Semua data barang supplier ini juga akan dihapus.`)) {
      if (detailSupplier?.id === s.id) setDetailSupplier(null);
      deleteMutation.mutate(s.id);
    }
  };

  const getMatchedItems = (s: Supplier, q: string): SupplierItem[] => {
    if (!q) return [];
    return s.items.filter(
      (item) =>
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Supplier</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola daftar supplier dan harga beli per produk</p>
        </div>
        <button
          onClick={() => setFormModal({ open: true, supplier: null })}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Supplier
        </button>
      </div>

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

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-base font-medium text-muted-foreground">
            {search ? `Tidak ada supplier yang menyediakan "${search}"` : "Belum ada supplier"}
          </p>
          {!search && (
            <p className="text-sm text-muted-foreground/70 mt-1">Klik "Tambah Supplier" untuk memulai</p>
          )}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((supplier) => (
            <div key={supplier.id} className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-base truncate">{supplier.name}</h3>
                    {supplier.contactPerson && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">{supplier.contactPerson}</span>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Package className="h-3 w-3" />
                    {supplier.items.length} item
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {supplier.phone && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />{supplier.phone}
                    </span>
                  )}
                  {supplier.email && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground truncate max-w-[180px]">
                      <Mail className="h-3 w-3 shrink-0" />{supplier.email}
                    </span>
                  )}
                  {supplier.address && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground truncate max-w-[200px]">
                      <MapPin className="h-3 w-3 shrink-0" />{supplier.address}
                    </span>
                  )}
                </div>

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

      {formModal.open && (
        <SupplierFormModal
          supplier={formModal.supplier}
          onClose={() => setFormModal({ open: false })}
          onSave={handleSaveSupplier}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

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
