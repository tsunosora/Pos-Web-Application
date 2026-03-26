"use client";

import { useState } from "react";
import { X, Search, ChevronDown } from "lucide-react";
import { SupplierItem, Product, ProductVariant } from "./types";

interface ItemFormModalProps {
  item?: SupplierItem | null;
  products: Product[];
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}

export function ItemFormModal({ item, products, onClose, onSave, isSaving }: ItemFormModalProps) {
  const [variantSearch, setVariantSearch] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(item?.productVariantId ?? null);
  const [purchasePrice, setPurchasePrice] = useState(item?.purchasePrice ? String(item.purchasePrice) : "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const allVariants: { variant: ProductVariant; productName: string }[] = products.flatMap((p) =>
    (p.variants || []).map((v) => ({ variant: v, productName: p.name }))
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {item ? "Edit Barang Supplier" : "Tambah Barang"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
                      <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada produk ditemukan</p>
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Catatan</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

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
