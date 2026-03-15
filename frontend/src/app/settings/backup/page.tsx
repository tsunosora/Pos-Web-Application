"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Download, Upload, Database, CheckSquare, Square, Shield,
    AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp,
    Trash2, ArrowLeft, Info, FileArchive, Image
} from "lucide-react";
import Link from "next/link";
import { getBackupGroups, exportBackup, previewBackupFile, restoreBackup } from "@/lib/api";

const ICON_MAP: Record<string, string> = {
    master: "🏷️", users: "👤", products: "📦", suppliers: "🚚",
    customers: "👥", hpp: "🧮", transactions: "💰", invoices: "📄",
    production: "🏭", opname: "📋", reports: "📊",
};

export default function BackupPage() {
    const { data: groups = [] } = useQuery({ queryKey: ["backup-groups"], queryFn: getBackupGroups });

    // ── Export state ────────────────────────────────────────────────────────
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [includeImages, setIncludeImages] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);

    // ── Restore state ───────────────────────────────────────────────────────
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [restorePreview, setRestorePreview] = useState<any | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [restoreMode, setRestoreMode] = useState<"skip" | "overwrite">("skip");
    const [selectedRestoreTables, setSelectedRestoreTables] = useState<Set<string>>(new Set());
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreResult, setRestoreResult] = useState<any | null>(null);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [showTableDetail, setShowTableDetail] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Export helpers ──────────────────────────────────────────────────────
    const allGroupKeys = groups.map((g: any) => g.key);
    const allSelected = allGroupKeys.length > 0 && allGroupKeys.every((k: string) => selectedGroups.has(k));

    const toggleGroup = (key: string) => {
        setSelectedGroups(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedGroups(allSelected ? new Set() : new Set(allGroupKeys));
    };

    const handleExport = async () => {
        if (selectedGroups.size === 0) return alert("Pilih minimal satu grup data untuk dibackup.");
        setIsExporting(true);
        setExportSuccess(false);
        try {
            const groupList = allSelected ? ["all"] : [...selectedGroups];
            const blob = await exportBackup(groupList, includeImages);
            const dateStr = new Date().toISOString().split("T")[0];
            const label = allSelected ? "full" : [...selectedGroups].join("-");
            const suffix = includeImages ? "" : "-dataonly";
            const filename = `pospro-backup-${label}${suffix}-${dateStr}.zip`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 3000);
        } catch {
            alert("Gagal mengekspor backup.");
        } finally {
            setIsExporting(false);
        }
    };

    // ── Restore helpers ─────────────────────────────────────────────────────
    const handleFileSelect = async (file: File) => {
        const isZip = file.name.endsWith(".zip");
        const isJson = file.name.endsWith(".json");
        if (!isZip && !isJson) return alert("Hanya file .zip atau .json yang diterima.");
        setRestoreFile(file);
        setRestoreResult(null);
        setPreviewLoading(true);
        try {
            const preview = await previewBackupFile(file);
            setRestorePreview(preview);
            setSelectedRestoreTables(new Set(preview.preview.map((p: any) => p.table)));
        } catch {
            alert("File backup tidak valid atau rusak.");
            setRestoreFile(null);
            setRestorePreview(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelect(file);
    };

    const toggleRestoreTable = (table: string) => {
        setSelectedRestoreTables(prev => {
            const next = new Set(prev);
            next.has(table) ? next.delete(table) : next.add(table);
            return next;
        });
    };

    const handleRestore = async () => {
        if (!restoreFile || selectedRestoreTables.size === 0) return;
        setShowRestoreConfirm(false);
        setIsRestoring(true);
        setRestoreResult(null);
        try {
            const tables = [...selectedRestoreTables];
            const result = await restoreBackup(restoreFile, restoreMode, tables);
            setRestoreResult(result);
        } catch (e: any) {
            setRestoreResult({ error: e?.response?.data?.message || "Gagal melakukan restore." });
        } finally {
            setIsRestoring(false);
        }
    };

    const resetRestore = () => {
        setRestoreFile(null);
        setRestorePreview(null);
        setRestoreResult(null);
        setShowRestoreConfirm(false);
        setShowTableDetail(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const isZipFile = restoreFile?.name.endsWith(".zip");

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/settings" className="p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Database className="w-6 h-6 text-primary" /> Backup & Recovery
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Ekspor data & foto ke file ZIP, atau restore dari file backup ke sistem baru.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                {/* ── SECTION BACKUP / EXPORT ─────────────────────────────── */}
                <div className="glass p-6 rounded-xl border border-border shadow-sm space-y-5">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-950/40 rounded-lg">
                            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold">Ekspor Backup</h2>
                            <p className="text-xs text-muted-foreground">Pilih data yang ingin disimpan. Hasil backup berupa file <strong>.zip</strong> berisi data + foto.</p>
                        </div>
                    </div>

                    {/* Info isi ZIP */}
                    <div className="flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2.5 text-blue-700 dark:text-blue-400">
                        <FileArchive className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-semibold">Isi file ZIP backup:</p>
                            <p>• <strong>data.json</strong> — semua record database yang dipilih</p>
                            <p>• <strong>uploads/</strong> — semua foto produk, logo, dll.</p>
                        </div>
                    </div>

                    {/* Pilih semua */}
                    <button
                        type="button"
                        onClick={toggleAll}
                        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                        {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        {allSelected ? "Batalkan Semua" : "Pilih Semua Data"}
                    </button>

                    {/* Grup Checkbox */}
                    <div className="space-y-2">
                        {groups.map((group: any) => (
                            <label key={group.key} className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition-colors">
                                <div className="mt-0.5">
                                    {selectedGroups.has(group.key)
                                        ? <CheckSquare className="w-4 h-4 text-primary" />
                                        : <Square className="w-4 h-4 text-muted-foreground" />
                                    }
                                </div>
                                <input type="checkbox" className="hidden" checked={selectedGroups.has(group.key)} onChange={() => toggleGroup(group.key)} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">
                                        {ICON_MAP[group.key] || "📁"} {group.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                        {group.tables.join(", ")}
                                    </p>
                                </div>
                            </label>
                        ))}
                    </div>

                    {/* Toggle sertakan foto */}
                    <label className="flex items-center justify-between p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30 transition-colors">
                        <div>
                            <p className="text-sm font-medium flex items-center gap-2">
                                <Image className="w-4 h-4 text-muted-foreground" />
                                Sertakan Foto & Gambar
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {includeImages
                                    ? "Foto produk & logo akan masuk ke ZIP (file lebih besar, lebih lama)"
                                    : "Hanya data — lebih cepat, file lebih kecil"}
                            </p>
                        </div>
                        <div
                            onClick={() => setIncludeImages(v => !v)}
                            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${includeImages ? "bg-blue-500" : "bg-muted"}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includeImages ? "translate-x-5" : ""}`} />
                        </div>
                    </label>

                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={isExporting || selectedGroups.size === 0}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-5 py-3 rounded-xl font-semibold text-sm transition-colors shadow-md"
                    >
                        {isExporting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Membuat ZIP...</>
                        ) : exportSuccess ? (
                            <><CheckCircle2 className="w-4 h-4" /> Berhasil Diunduh!</>
                        ) : (
                            <><FileArchive className="w-4 h-4" /> Backup Sekarang ({selectedGroups.size} grup)</>
                        )}
                    </button>
                </div>

                {/* ── SECTION RESTORE / IMPORT ────────────────────────────── */}
                <div className="glass p-6 rounded-xl border border-border shadow-sm space-y-5">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <div className="p-2 bg-green-100 dark:bg-green-950/40 rounded-lg">
                            <Upload className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold">Restore dari Backup</h2>
                            <p className="text-xs text-muted-foreground">Upload file backup <strong>.zip</strong> untuk memulihkan data & foto.</p>
                        </div>
                    </div>

                    {!restoreFile ? (
                        /* Drop Zone */
                        <div
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleFileDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                        >
                            <FileArchive className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                            <p className="text-sm font-medium text-foreground">Drag & drop file backup di sini</p>
                            <p className="text-xs text-muted-foreground mt-1">atau klik untuk pilih file</p>
                            <p className="text-xs text-muted-foreground/60 mt-2">Format: .zip (pospro-backup-*.zip) atau .json (backup lama)</p>
                            <input ref={fileInputRef} type="file" accept=".zip,.json" className="hidden"
                                onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* File info */}
                            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
                                <FileArchive className="w-8 h-8 text-green-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{restoreFile.name}</p>
                                    <p className="text-xs text-muted-foreground">{(restoreFile.size / 1024).toFixed(1)} KB</p>
                                </div>
                                <button type="button" onClick={resetRestore} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {previewLoading && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 justify-center">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Menganalisis file...
                                </div>
                            )}

                            {restorePreview && !previewLoading && (
                                <>
                                    {/* Meta info */}
                                    <div className="text-xs space-y-1 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <p className="font-semibold text-blue-700 dark:text-blue-400">Info Backup</p>
                                        <p className="text-muted-foreground">Dibuat: {new Date(restorePreview.meta.createdAt).toLocaleString('id-ID')}</p>
                                        <p className="text-muted-foreground">Aplikasi: {restorePreview.meta.app} v{restorePreview.meta.version}</p>
                                        {isZipFile && restorePreview.imageCount !== undefined && (
                                            <p className="text-muted-foreground flex items-center gap-1">
                                                <Image className="w-3 h-3" />
                                                {restorePreview.imageCount} file foto akan dipulihkan
                                            </p>
                                        )}
                                    </div>

                                    {/* Pilih mode restore */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-foreground/80">Mode Restore</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button type="button" onClick={() => setRestoreMode("skip")}
                                                className={`flex flex-col items-start p-3 rounded-lg border text-left text-xs transition-all ${restoreMode === "skip" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"}`}>
                                                <span className="font-semibold">Skip Existing</span>
                                                <span className="text-muted-foreground mt-0.5">Data yang sudah ada tidak akan ditimpa. Aman untuk migrasi parsial.</span>
                                            </button>
                                            <button type="button" onClick={() => setRestoreMode("overwrite")}
                                                className={`flex flex-col items-start p-3 rounded-lg border text-left text-xs transition-all ${restoreMode === "overwrite" ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400" : "border-border hover:bg-muted/40"}`}>
                                                <span className="font-semibold">Overwrite</span>
                                                <span className="text-muted-foreground mt-0.5">Hapus & tulis ulang. Gunakan untuk restore penuh di sistem baru.</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pilih tabel — collapsible */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <button type="button" onClick={() => setShowTableDetail(v => !v)}
                                                className="flex items-center gap-1 text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors">
                                                {showTableDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                Data yang akan direstore ({selectedRestoreTables.size}/{restorePreview.preview.length} tabel)
                                            </button>
                                            {showTableDetail && (
                                                <button type="button"
                                                    onClick={() => setSelectedRestoreTables(new Set(restorePreview.preview.map((p: any) => p.table)))}
                                                    className="text-xs text-primary hover:underline">
                                                    Pilih Semua
                                                </button>
                                            )}
                                        </div>
                                        {showTableDetail && (
                                            <div className="max-h-44 overflow-y-auto space-y-1 pr-1 border border-border rounded-lg p-2">
                                                {restorePreview.preview.map((item: any) => (
                                                    <label key={item.table} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer text-xs">
                                                        <input type="checkbox" checked={selectedRestoreTables.has(item.table)}
                                                            onChange={() => toggleRestoreTable(item.table)}
                                                            className="w-3.5 h-3.5 accent-primary" />
                                                        <span className="flex-1 font-mono text-foreground/80">{item.table}</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${item.count > 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                                                            {item.count} baris
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Warning overwrite */}
                                    {restoreMode === "overwrite" && (
                                        <div className="flex items-start gap-2 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <span>Mode Overwrite akan <strong>menghapus semua data</strong> pada tabel yang dipilih sebelum mengisi ulang dari backup.</span>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setShowRestoreConfirm(true)}
                                        disabled={isRestoring || selectedRestoreTables.size === 0}
                                        className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-colors shadow-md disabled:opacity-50 text-white ${restoreMode === "overwrite" ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}`}
                                    >
                                        {isRestoring
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Merestore...</>
                                            : <><Upload className="w-4 h-4" /> Restore ({restoreMode === "overwrite" ? "Overwrite" : "Skip Existing"})</>
                                        }
                                    </button>
                                </>
                            )}

                            {/* Hasil restore */}
                            {restoreResult && (
                                <div className={`p-4 rounded-xl border space-y-3 ${restoreResult.error ? "border-destructive/50 bg-destructive/5" : "border-green-500/50 bg-green-50 dark:bg-green-950/20"}`}>
                                    {restoreResult.error ? (
                                        <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                            <AlertTriangle className="w-4 h-4" /> {restoreResult.error}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold text-sm">
                                                <CheckCircle2 className="w-4 h-4" /> {restoreResult.message}
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="bg-white dark:bg-muted/30 rounded-lg p-2 text-center border border-border">
                                                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{restoreResult.totalRestored}</p>
                                                    <p className="text-muted-foreground">Baris Data</p>
                                                </div>
                                                <div className="bg-white dark:bg-muted/30 rounded-lg p-2 text-center border border-border">
                                                    <p className="text-lg font-bold text-muted-foreground">{restoreResult.totalSkipped}</p>
                                                    <p className="text-muted-foreground">Dilewati</p>
                                                </div>
                                                <div className="bg-white dark:bg-muted/30 rounded-lg p-2 text-center border border-border">
                                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{restoreResult.imagesRestored ?? 0}</p>
                                                    <p className="text-muted-foreground">Foto</p>
                                                </div>
                                            </div>
                                            {restoreResult.errors?.length > 0 && (
                                                <div className="text-xs text-destructive space-y-1">
                                                    <p className="font-semibold">Error ({restoreResult.errors.length}):</p>
                                                    {restoreResult.errors.slice(0, 5).map((e: string, i: number) => (
                                                        <p key={i} className="font-mono bg-destructive/5 rounded px-2 py-1 break-all">{e}</p>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Panduan ─────────────────────────────────────────────────── */}
            <div className="glass p-6 rounded-xl border border-border shadow-sm">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" /> Panduan Backup & Recovery
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                    <div className="space-y-1.5">
                        <p className="font-semibold text-foreground">📦 Isi File ZIP Backup</p>
                        <p>File backup berisi <strong>data.json</strong> (semua record database) dan folder <strong>uploads/</strong> (semua foto produk, logo toko, dll). Semua dalam satu file.</p>
                    </div>
                    <div className="space-y-1.5">
                        <p className="font-semibold text-foreground">🖥️ Migrasi Sistem Baru</p>
                        <p>Backup semua data → Install PosPro di PC baru → Restore dengan mode <strong>Overwrite</strong>. Data dan foto akan dipulihkan otomatis.</p>
                    </div>
                    <div className="space-y-1.5">
                        <p className="font-semibold text-foreground">⚠️ Perbedaan Mode</p>
                        <p><strong>Skip Existing</strong>: tidak menimpa data yang sudah ada. <strong>Overwrite</strong>: hapus & tulis ulang. Gunakan Overwrite hanya di sistem kosong/baru.</p>
                    </div>
                </div>
            </div>

            {/* ── Info tambahan ─────────────────────────────────────────────── */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <div>
                    <p className="font-semibold text-foreground mb-1">Backup file .json lama tetap bisa direstore</p>
                    <p>Format .json dari versi sebelumnya masih kompatibel. Upload file .json dan sistem akan otomatis mendeteksinya. Namun foto tidak akan termasuk karena format lama tidak mendukung.</p>
                </div>
            </div>

            {/* ── Konfirmasi Modal ─────────────────────────────────────────── */}
            {showRestoreConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-2xl border border-border shadow-2xl p-6 max-w-md w-full space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${restoreMode === "overwrite" ? "bg-orange-100 dark:bg-orange-950/40" : "bg-green-100 dark:bg-green-950/40"}`}>
                                <AlertTriangle className={`w-5 h-5 ${restoreMode === "overwrite" ? "text-orange-600" : "text-green-600"}`} />
                            </div>
                            <h3 className="font-bold text-base">Konfirmasi Restore</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Anda akan merestore <strong>{selectedRestoreTables.size} tabel</strong> dari file <strong>{restoreFile?.name}</strong> dengan mode <strong>{restoreMode === "overwrite" ? "Overwrite (hapus & tulis ulang)" : "Skip Existing"}</strong>.
                            {isZipFile && restorePreview?.imageCount > 0 && (
                                <span> Foto sebanyak <strong>{restorePreview.imageCount} file</strong> juga akan dipulihkan.</span>
                            )}
                        </p>
                        {restoreMode === "overwrite" && (
                            <p className="text-sm text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 rounded-lg px-3 py-2 border border-orange-200 dark:border-orange-800">
                                ⚠️ Tindakan ini tidak bisa dibatalkan. Semua data di tabel yang dipilih akan dihapus dan diganti dengan data dari backup.
                            </p>
                        )}
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => setShowRestoreConfirm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                                Batal
                            </button>
                            <button type="button" onClick={handleRestore}
                                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${restoreMode === "overwrite" ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}`}>
                                Ya, Restore Sekarang
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
