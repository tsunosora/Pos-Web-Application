"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCategories, updateProduct } from "@/lib/api";
import { X, Search, Check, FolderTree, Loader2 } from "lucide-react";

type Cat = { id: number; name: string; parentId: number | null; parent?: { id: number; name: string } | null };

/**
 * Modal ringan untuk ganti kategori SATU produk tanpa buka halaman edit penuh.
 * Deliberate: pilih kategori lalu klik Simpan (tidak ada perubahan tak sengaja).
 * Hanya PATCH { categoryId } → varian/harga produk tidak tersentuh.
 */
export default function ChangeCategoryModal({
    product, onClose,
}: {
    product: { id: number; name: string; category?: { id: number; name: string; parent?: { id: number; name: string } | null } | null };
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const currentId = product.category?.id ?? null;
    const [selectedId, setSelectedId] = useState<number | null>(currentId);
    const [search, setSearch] = useState("");

    const { data: categories = [], isLoading } = useQuery<Cat[]>({ queryKey: ["categories"], queryFn: getCategories });

    const label = (c: Cat) => (c.parentId && c.parent ? `${c.parent.name} › ${c.name}` : c.name);

    const list = useMemo(() => {
        const sorted = [...categories].sort((a, b) => label(a).localeCompare(label(b)));
        const q = search.trim().toLowerCase();
        return q ? sorted.filter((c) => label(c).toLowerCase().includes(q)) : sorted;
    }, [categories, search]);

    const mutation = useMutation({
        mutationFn: (categoryId: number) => updateProduct(product.id, { categoryId }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); onClose(); },
    });

    const dirty = selectedId != null && selectedId !== currentId;
    const save = () => { if (dirty) mutation.mutate(selectedId!); };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-background/25 backdrop-blur-md" onClick={onClose}>
            <div
                className="glass-strong w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-border shadow-lg overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-lg leading-tight">Ganti Kategori</h3>
                        <p className="text-xs text-muted-foreground truncate">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
                </div>

                {/* Kategori saat ini + cari */}
                <div className="p-4 space-y-3 border-b border-border shrink-0">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Kategori saat ini</span>
                        <span className="font-medium text-foreground">
                            {product.category ? (product.category.parent ? `${product.category.parent.name} › ${product.category.name}` : product.category.name) : "—"}
                        </span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari kategori..."
                            className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                        />
                    </div>
                </div>

                {/* Daftar kategori (scroll) */}
                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
                    ) : list.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">Tidak ada kategori cocok.</div>
                    ) : (
                        list.map((c) => {
                            const active = selectedId === c.id;
                            const isCurrent = currentId === c.id;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedId(c.id)}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}
                                >
                                    <span className="flex items-center gap-2 min-w-0">
                                        <FolderTree className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                                        <span className="truncate">{label(c)}</span>
                                        {isCurrent && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">sekarang</span>}
                                    </span>
                                    {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="flex gap-2 p-4 border-t border-border shrink-0">
                    <button onClick={onClose} className="px-4 py-3 sm:py-2.5 rounded-lg border border-border hover:bg-muted font-medium text-sm">Batal</button>
                    <button
                        onClick={save}
                        disabled={!dirty || mutation.isPending}
                        className="flex-1 py-3 sm:py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-50"
                    >
                        {mutation.isPending ? "Menyimpan..." : "Simpan Kategori"}
                    </button>
                </div>
            </div>
        </div>
    );
}
