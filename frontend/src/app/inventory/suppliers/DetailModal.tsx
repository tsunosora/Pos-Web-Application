"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addSupplierItem, updateSupplierItem, deleteSupplierItem } from "@/lib/api";
import { Pencil, Trash2, Plus, Package, Phone, Mail, MapPin, FileText, User, X } from "lucide-react";
import { Supplier, SupplierItem, Product } from "./types";
import { ItemFormModal } from "./ItemFormModal";

interface DetailModalProps {
  supplier: Supplier;
  products: Product[];
  onClose: () => void;
  onEditSupplier: (s: Supplier) => void;
}

export function DetailModal({ supplier, products, onClose, onEditSupplier }: DetailModalProps) {
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
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

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

      {addItemOpen && (
        <ItemFormModal
          products={products}
          onClose={() => setAddItemOpen(false)}
          onSave={(data) => addItemMutation.mutate(data)}
          isSaving={addItemMutation.isPending}
        />
      )}

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
