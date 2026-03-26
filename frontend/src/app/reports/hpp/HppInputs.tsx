"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export function CustomNameInput({ value, onChange, onSwitchToStock }: { value: string; onChange: (val: string) => void; onSwitchToStock: () => void }) {
    const [local, setLocal] = useState(value);
    useEffect(() => { setLocal(value); }, [value]);
    return (
        <div className="relative flex items-center">
            <input
                type="text"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={() => onChange(local)}
                placeholder="Tulis nama bahan..."
                autoFocus
                className="w-full pl-3 pr-8 py-2 bg-background border border-primary rounded-[6px] text-[13px] font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/20"
            />
            <button type="button" title="Pilih dari stok" onClick={onSwitchToStock} className="absolute right-2 text-muted-foreground hover:text-green-600 transition-colors">
                <Database className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

interface VariantComboboxProps {
    rowId: string;
    currentVariantId?: number;
    currentName: string;
    dbProducts: any[];
    onSelectVariant: (rowId: string, variantId: string) => void;
    onSelectManual: (rowId: string, initialName?: string) => void;
}

export function VariantCombobox({ rowId, currentVariantId, currentName, dbProducts, onSelectVariant, onSelectManual }: VariantComboboxProps) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleUseAsCustom = (name: string) => {
        onSelectManual(rowId, name.trim());
        setOpen(false);
        setQuery('');
    };

    const allVariants = useMemo(() => {
        const result: { label: string; variantId: string }[] = [];
        for (const p of dbProducts) {
            for (const v of (p.variants || [])) {
                result.push({ label: p.name + (v.variantName ? ` – ${v.variantName}` : ''), variantId: String(v.id) });
            }
        }
        return result;
    }, [dbProducts]);

    const filtered = useMemo(() => {
        if (!query.trim()) return allVariants.slice(0, 60);
        const q = query.toLowerCase();
        return allVariants.filter(v => v.label.toLowerCase().includes(q)).slice(0, 60);
    }, [query, allVariants]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div
                className="flex items-center bg-card border border-green-500 rounded-[6px] overflow-hidden cursor-text"
                onClick={() => { setOpen(true); }}
            >
                {open ? (
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && query.trim() && filtered.length === 0) {
                                handleUseAsCustom(query);
                            }
                        }}
                        placeholder="Ketik untuk mencari bahan baku..."
                        className="flex-1 pl-3 pr-2 py-2 bg-transparent text-[13px] font-semibold text-foreground outline-none"
                    />
                ) : (
                    <span className={cn("flex-1 pl-3 pr-2 py-2 text-[13px] font-semibold truncate", currentVariantId ? "text-foreground" : "text-muted-foreground")}>
                        {currentName || '— Pilih Bahan dari Stok —'}
                    </span>
                )}
                <Search className="w-3.5 h-3.5 text-green-500 mr-2 shrink-0 pointer-events-none" />
            </div>
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-[6px] shadow-lg max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                        query.trim() ? (
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); handleUseAsCustom(query); }}
                                className="w-full text-left px-3 py-2.5 text-[13px] text-primary font-semibold hover:bg-primary/10 transition-colors"
                            >
                                ➕ Tambah &ldquo;{query}&rdquo; sebagai bahan custom
                            </button>
                        ) : (
                            <div className="px-3 py-2 text-[12px] text-muted-foreground">Ketik nama bahan...</div>
                        )
                    ) : filtered.map(item => (
                        <button
                            key={item.variantId}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onSelectVariant(rowId, item.variantId);
                                setOpen(false);
                                setQuery('');
                            }}
                            className={cn(
                                "w-full text-left px-3 py-2 text-[13px] hover:bg-primary/10 transition-colors",
                                currentVariantId && String(currentVariantId) === item.variantId ? "bg-primary/10 font-semibold" : ""
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            handleUseAsCustom(query);
                        }}
                        className="w-full text-left px-3 py-2 text-[13px] text-orange-600 font-bold border-t border-border hover:bg-orange-50 transition-colors"
                    >
                        ✏️ Input Manual (tidak ada di stok)
                    </button>
                </div>
            )}
        </div>
    );
}
