"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
    Plus, Pencil, Trash2, Layers, Search, X, Loader2,
    Building2, Target, MapPin, TrendingUp, Eye, EyeOff, Info, Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getBranches, createBranch, updateBranch, deleteBranch,
    getCompetitors, createCompetitor, updateCompetitor, deleteCompetitor
} from "@/lib/api";
import type { Branch, Competitor, SearchResult, Layers as LayersType } from "./MapComponent";

const MapComponent = dynamic(() => import("./MapComponent"), { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
)});

// ---------- Helpers ----------
const fmtCurrency = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

const COMPETITOR_TYPES = ["Digital Printing", "Sablon", "Percetakan", "Fotokopi", "Desain Grafis", "Spanduk & Banner", "Toko ATK", "Toko Komputer", "Lainnya"];

const getMarginColor = (m: number) => m > 35 ? "text-emerald-600" : m >= 15 ? "text-amber-600" : "text-red-500";
const getMarginBg = (m: number) => m > 35 ? "bg-emerald-500/10" : m >= 15 ? "bg-amber-500/10" : "bg-red-500/10";

// Nominatim geocoding
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=id`;
    const res = await fetch(url, { headers: { "Accept-Language": "id" } });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    return null;
}

// Overpass API keyword search for businesses
async function searchBusinessesByKeyword(keyword: string, bounds: { south: number; west: number; north: number; east: number }): Promise<SearchResult[]> {
    const { south, west, north, east } = bounds;
    const query = `[out:json][timeout:15];(node["name"~"${keyword}",i](${south},${west},${north},${east});way["name"~"${keyword}",i](${south},${west},${north},${east}););out center;`;
    try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: `data=${encodeURIComponent(query)}`,
        });
        const data = await res.json();
        return (data.elements ?? [])
            .filter((el: any) => el.lat || el.center)
            .map((el: any) => ({
                id: String(el.id),
                name: el.tags?.name ?? keyword,
                address: [el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(", "),
                lat: el.lat ?? el.center?.lat,
                lon: el.lon ?? el.center?.lon,
            }));
    } catch {
        return [];
    }
}

// ---------- Form Modal ----------
type FormMode = "branch-add" | "branch-edit" | "competitor-add" | "competitor-edit" | null;

function FormModal({ mode, initial, pendingLat, pendingLng, onClose, onSave, isPending }: {
    mode: FormMode;
    initial?: any;
    pendingLat?: number | null;
    pendingLng?: number | null;
    onClose: () => void;
    onSave: (data: any) => void;
    isPending: boolean;
}) {
    const isBranch = mode === "branch-add" || mode === "branch-edit";

    const [name, setName] = useState(initial?.name ?? "");
    const [address, setAddress] = useState(initial?.address ?? "");
    const [lat, setLat] = useState(String(initial?.latitude ?? pendingLat ?? ""));
    const [lng, setLng] = useState(String(initial?.longitude ?? pendingLng ?? ""));
    const [omset, setOmset] = useState(String(parseFloat(initial?.omset ?? "0")));
    const [margin, setMargin] = useState(String(parseFloat(initial?.margin ?? "0")));
    const [type, setType] = useState(initial?.type ?? "");
    const [notes, setNotes] = useState(initial?.notes ?? "");
    const [geocoding, setGeocoding] = useState(false);

    const handleGeocode = async () => {
        if (!address) return;
        setGeocoding(true);
        const result = await geocodeAddress(address);
        setGeocoding(false);
        if (result) { setLat(String(result.lat)); setLng(String(result.lon)); }
        else alert("Alamat tidak ditemukan. Coba lebih spesifik (misal: Jl. Sudirman, Jakarta)");
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isBranch) {
            onSave({ name, address, latitude: parseFloat(lat), longitude: parseFloat(lng), omset: parseFloat(omset) || 0, margin: parseFloat(margin) || 0 });
        } else {
            onSave({ name, type, address, latitude: parseFloat(lat), longitude: parseFloat(lng), notes });
        }
    };

    const title = mode === "branch-add" ? "Tambah Cabang" : mode === "branch-edit" ? "Edit Cabang" : mode === "competitor-add" ? "Tambah Kompetitor" : "Edit Kompetitor";

    return (
        <div className="fixed inset-0 bg-background/88 backdrop-blur-3xl z-[500] flex items-center justify-center p-4">
            <div className="glass-strong w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Nama *</label>
                        <input required value={name} onChange={e => setName(e.target.value)} placeholder={isBranch ? "Cabang Sudirman" : "Nama kompetitor"} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    {!isBranch && (
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Tipe / Kategori</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                <option value="">-- Pilih --</option>
                                {COMPETITOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Alamat</label>
                        <div className="flex gap-2">
                            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Jl. ..." className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            <button type="button" onClick={handleGeocode} disabled={geocoding || !address} title="Auto-isi koordinat dari alamat"
                                className="shrink-0 px-3 py-2 rounded-lg border border-input bg-background text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50 transition-colors">
                                {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "📍 Cari"}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">Klik "📍 Cari" untuk auto-isi koordinat. Atau klik langsung di peta.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Latitude *</label>
                            <input required type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="-6.200" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Longitude *</label>
                            <input required type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="106.816" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                    </div>
                    {isBranch && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Omset Bulanan (Rp)</label>
                                <input type="number" min="0" value={omset} onChange={e => setOmset(e.target.value)} placeholder="0" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Margin (%)</label>
                                <input type="number" min="0" max="100" step="0.1" value={margin} onChange={e => setMargin(e.target.value)} placeholder="0" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                        </div>
                    )}
                    {!isBranch && (
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Catatan</label>
                            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Kekuatan/kelemahan kompetitor..." className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {isPending ? "Menyimpan..." : "Simpan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ---------- Main Page ----------
export default function MapsPage() {
    const queryClient = useQueryClient();

    // Sidebar
    const [activeTab, setActiveTab] = useState<"branches" | "competitors">("branches");
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Layers visibility
    const [layers, setLayers] = useState<LayersType>({ branches: true, competitors: true, searchResults: true });
    const toggleLayer = (key: keyof LayersType) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

    // Adding mode (click on map)
    const [addingMode, setAddingMode] = useState<"branch" | "competitor" | null>(null);
    const [pendingLat, setPendingLat] = useState<number | null>(null);
    const [pendingLng, setPendingLng] = useState<number | null>(null);
    const [formMode, setFormMode] = useState<FormMode>(null);
    const [editItem, setEditItem] = useState<any>(null);

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState<{ type: "branch" | "competitor"; id: number } | null>(null);

    // Keyword search
    const [keyword, setKeyword] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [mapBounds, setMapBounds] = useState<{ south: number; west: number; north: number; east: number } | null>(null);

    // Data
    const { data: branchesData } = useQuery({ queryKey: ["branches"], queryFn: getBranches });
    const { data: competitorsData } = useQuery({ queryKey: ["competitors"], queryFn: getCompetitors });

    const branches: Branch[] = branchesData ?? [];
    const competitors: Competitor[] = competitorsData ?? [];

    const invalidateBranches = () => queryClient.invalidateQueries({ queryKey: ["branches"] });
    const invalidateCompetitors = () => queryClient.invalidateQueries({ queryKey: ["competitors"] });

    const createBranchMutation = useMutation({ mutationFn: createBranch, onSuccess: () => { invalidateBranches(); setFormMode(null); setAddingMode(null); } });
    const updateBranchMutation = useMutation({ mutationFn: ({ id, data }: any) => updateBranch(id, data), onSuccess: () => { invalidateBranches(); setFormMode(null); setEditItem(null); } });
    const deleteBranchMutation = useMutation({ mutationFn: deleteBranch, onSuccess: () => { invalidateBranches(); setDeleteTarget(null); } });

    const createCompetitorMutation = useMutation({ mutationFn: createCompetitor, onSuccess: () => { invalidateCompetitors(); setFormMode(null); setAddingMode(null); } });
    const updateCompetitorMutation = useMutation({ mutationFn: ({ id, data }: any) => updateCompetitor(id, data), onSuccess: () => { invalidateCompetitors(); setFormMode(null); setEditItem(null); } });
    const deleteCompetitorMutation = useMutation({ mutationFn: deleteCompetitor, onSuccess: () => { invalidateCompetitors(); setDeleteTarget(null); } });

    const handleSave = (data: any) => {
        if (formMode === "branch-add") createBranchMutation.mutate(data);
        else if (formMode === "branch-edit") updateBranchMutation.mutate({ id: editItem.id, data });
        else if (formMode === "competitor-add") createCompetitorMutation.mutate(data);
        else if (formMode === "competitor-edit") updateCompetitorMutation.mutate({ id: editItem.id, data });
    };

    const isSaving = createBranchMutation.isPending || updateBranchMutation.isPending || createCompetitorMutation.isPending || updateCompetitorMutation.isPending;

    const handleMapClick = useCallback((lat: number, lng: number) => {
        setPendingLat(lat);
        setPendingLng(lng);
        setFormMode(addingMode === "branch" ? "branch-add" : "competitor-add");
    }, [addingMode]);

    const handleBoundsChange = useCallback((bounds: { south: number; west: number; north: number; east: number }) => {
        setMapBounds(bounds);
    }, []);

    const handleKeywordSearch = async () => {
        if (!keyword.trim() || !mapBounds) return;
        setSearching(true);
        const results = await searchBusinessesByKeyword(keyword.trim(), mapBounds);
        setSearchResults(results);
        setSearching(false);
        if (results.length === 0) alert(`Tidak ditemukan hasil untuk "${keyword}" di area peta saat ini. Coba perbesar area atau ganti keyword.`);
    };

    const clearSearch = () => { setSearchResults([]); setKeyword(""); };

    return (
        <div className="flex flex-col h-full space-y-0 -m-6 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
            {/* Top bar */}
            <div className="shrink-0 px-3 sm:px-6 py-3 bg-card border-b border-border flex items-center gap-2 sm:gap-4">
                {/* Mobile sidebar toggle */}
                <button
                    onClick={() => setMobileSidebarOpen(o => !o)}
                    className="lg:hidden shrink-0 p-2 rounded-lg border border-input text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    <Menu className="h-4 w-4" />
                </button>

                <div className="hidden sm:block shrink-0">
                    <h1 className="text-lg font-bold text-foreground">Peta Cuan Lokasi</h1>
                    <p className="text-xs text-muted-foreground">Analisis lokasi cabang &amp; kompetitor bisnis</p>
                </div>

                {/* Keyword search */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-1 flex items-center gap-2 bg-background border border-input rounded-lg px-3 py-2 min-w-0">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <input
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleKeywordSearch()}
                            placeholder="Cari bisnis di peta..."
                            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground min-w-0"
                        />
                        {keyword && <button onClick={clearSearch} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>}
                    </div>
                    <button onClick={handleKeywordSearch} disabled={searching || !keyword.trim()}
                        className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="hidden sm:inline">Cari</span>
                    </button>
                </div>

                {/* Layer toggles - hidden on mobile */}
                <div className="hidden md:flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">Layer:</span>
                    {([
                        { key: "branches" as const, label: "Cabang", color: "#22c55e" },
                        { key: "competitors" as const, label: "Kompetitor", color: "#ef4444" },
                        { key: "searchResults" as const, label: `Cari (${searchResults.length})`, color: "#3b82f6" },
                    ]).map(l => (
                        <button key={l.key} onClick={() => toggleLayer(l.key)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${layers[l.key] ? "bg-card border-border text-foreground" : "bg-muted/40 border-transparent text-muted-foreground"}`}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: layers[l.key] ? l.color : "#9ca3af", display: "inline-block" }} />
                            {layers[l.key] ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            {l.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main content: sidebar + map */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile backdrop */}
                {mobileSidebarOpen && (
                    <div
                        className="lg:hidden absolute inset-0 z-[240] bg-background/82 backdrop-blur-3xl"
                        onClick={() => setMobileSidebarOpen(false)}
                    />
                )}

                {/* Left sidebar */}
                <div className={cn(
                    "w-72 shrink-0 flex-col bg-card border-r border-border overflow-hidden",
                    mobileSidebarOpen ? "absolute inset-y-0 left-0 z-[250] flex shadow-2xl" : "hidden lg:flex"
                )}>
                    {/* Tabs */}
                    <div className="flex border-b border-border shrink-0">
                        <button onClick={() => setActiveTab("branches")}
                            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${activeTab === "branches" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}>
                            <Building2 className="h-3.5 w-3.5" /> Cabang ({branches.length})
                        </button>
                        <button onClick={() => setActiveTab("competitors")}
                            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${activeTab === "competitors" ? "text-destructive border-b-2 border-destructive bg-destructive/5" : "text-muted-foreground hover:text-foreground"}`}>
                            <Target className="h-3.5 w-3.5" /> Kompetitor ({competitors.length})
                        </button>
                    </div>

                    {/* Add button + adding mode notice */}
                    <div className="px-3 py-2 shrink-0 border-b border-border space-y-2">
                        {addingMode ? (
                            <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
                                <p className="text-xs text-purple-600 font-medium">Klik di peta untuk menentukan lokasi</p>
                                <button onClick={() => setAddingMode(null)} className="text-purple-600 hover:text-purple-800"><X className="h-3.5 w-3.5" /></button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setAddingMode(activeTab === "branches" ? "branch" : "competitor");
                                    setPendingLat(null); setPendingLng(null);
                                }}
                                className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-2 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
                                <Plus className="h-3.5 w-3.5" />
                                Tambah {activeTab === "branches" ? "Cabang" : "Kompetitor"}
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {activeTab === "branches" ? (
                            branches.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">Belum ada cabang. Tambahkan cabang pertama Anda.</div>
                            ) : branches.map((b) => {
                                const margin = Number(b.margin ?? 0);
                                const omset = Number(b.omset ?? 0);
                                return (
                                    <div key={b.id} className="px-3 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: margin > 35 ? "#22c55e" : margin >= 15 ? "#f59e0b" : "#ef4444", display: "inline-block", flexShrink: 0 }} />
                                                    <p className="text-sm font-semibold text-foreground truncate">{b.name}</p>
                                                </div>
                                                {b.address && <p className="text-xs text-muted-foreground truncate pl-3.5">{b.address}</p>}
                                                <div className="flex items-center gap-2 mt-1.5 pl-3.5">
                                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${getMarginBg(margin)} ${getMarginColor(margin)}`}>{margin}% margin</span>
                                                    <span className="text-xs text-muted-foreground">{omset > 0 ? fmtCurrency(omset) : "—"}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => { setEditItem(b); setFormMode("branch-edit"); }} className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                                <button onClick={() => setDeleteTarget({ type: "branch", id: b.id })} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            competitors.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">Belum ada kompetitor tercatat. Tambahkan atau gunakan fitur pencarian di peta.</div>
                            ) : competitors.map((c) => (
                                <div key={c.id} className="px-3 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span style={{ width: 8, height: 8, background: "#ef4444", borderRadius: 2, transform: "rotate(45deg)", display: "inline-block", flexShrink: 0 }} />
                                                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                                            </div>
                                            {c.type && <span className="ml-3.5 text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">{c.type}</span>}
                                            {c.address && <p className="text-xs text-muted-foreground truncate mt-0.5 pl-3.5">{c.address}</p>}
                                            {c.notes && <p className="text-xs text-muted-foreground italic truncate mt-0.5 pl-3.5">{c.notes}</p>}
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => { setEditItem(c); setFormMode("competitor-edit"); }} className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => setDeleteTarget({ type: "competitor", id: c.id })} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Legend */}
                    <div className="shrink-0 border-t border-border p-3 bg-muted/20">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Layers className="h-3 w-3" /> Legenda</p>
                        <div className="space-y-1.5 text-xs text-foreground/80">
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" /> Profit Tinggi (&gt;35%)</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" /> Profit Sedang (15–35%)</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 shrink-0" /> Profit Rendah (&lt;15%)</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 shrink-0" style={{ background: "#ef4444", transform: "rotate(45deg)", borderRadius: 2 }} /> Kompetitor manual</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 shrink-0 opacity-80" /> Hasil pencarian</div>
                        </div>
                        {searchResults.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border">
                                <p className="text-xs text-blue-600 font-medium">{searchResults.length} hasil ditemukan untuk "{keyword}"</p>
                                <button onClick={clearSearch} className="text-xs text-muted-foreground hover:text-foreground underline mt-0.5">Hapus hasil pencarian</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Map */}
                <div className="flex-1 relative overflow-hidden">
                    {addingMode && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Klik di peta untuk menentukan lokasi {addingMode === "branch" ? "cabang" : "kompetitor"}
                        </div>
                    )}
                    <MapComponent
                        branches={branches}
                        competitors={competitors}
                        searchResults={searchResults}
                        layers={layers}
                        addingMode={addingMode}
                        onMapClick={handleMapClick}
                        onBoundsChange={handleBoundsChange}
                    />
                </div>
            </div>

            {/* Form modal */}
            {formMode && (
                <FormModal
                    mode={formMode}
                    initial={editItem}
                    pendingLat={pendingLat}
                    pendingLng={pendingLng}
                    onClose={() => { setFormMode(null); setEditItem(null); setAddingMode(null); }}
                    onSave={handleSave}
                    isPending={isSaving}
                />
            )}

            {/* Delete confirm */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-background/88 backdrop-blur-3xl z-[500] flex items-center justify-center p-4">
                    <div className="glass-strong w-full max-w-sm rounded-xl border border-border shadow-lg p-6">
                        <h3 className="font-semibold text-foreground mb-2">Hapus {deleteTarget.type === "branch" ? "Cabang" : "Kompetitor"}?</h3>
                        <p className="text-sm text-muted-foreground mb-5">Data tidak dapat dipulihkan.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                            <button onClick={() => {
                                if (deleteTarget.type === "branch") deleteBranchMutation.mutate(deleteTarget.id);
                                else deleteCompetitorMutation.mutate(deleteTarget.id);
                            }} disabled={deleteBranchMutation.isPending || deleteCompetitorMutation.isPending}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
