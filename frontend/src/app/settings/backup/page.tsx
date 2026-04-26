"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Download, Upload, Database, CheckSquare, Square, Shield,
    AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp,
    Trash2, ArrowLeft, Info, FileArchive, Image, Zap, MessageCircle,
    Server, RefreshCw, Clock, Play, HardDrive, ToggleLeft, ToggleRight
} from "lucide-react";
import Link from "next/link";
import { getBackupGroups, exportBackup, previewBackupFile, restoreBackup,
    getRcloneStatus, saveRcloneSettings, triggerRcloneBackup } from "@/lib/api";

const ICON_MAP: Record<string, string> = {
    master: "🏷️", branches: "🏢", users: "👤", products: "📦", suppliers: "🚚",
    customers: "👥", hpp: "🧮", transactions: "💰", invoices: "📄",
    salesOrders: "🎨", production: "🏭", branchWorkOrders: "🔁",
    stockTransfers: "🔄", interBranchLedger: "📒",
    clickCounting: "🖨️", opname: "📋", reports: "📊",
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

    // ── Auto-select all groups saat grup dimuat ─────────────────────────────
    const allGroupKeys: string[] = groups.map((g: any) => g.key);
    const allSelected = allGroupKeys.length > 0 && allGroupKeys.every((k: string) => selectedGroups.has(k));

    useEffect(() => {
        if (allGroupKeys.length > 0 && selectedGroups.size === 0) {
            setSelectedGroups(new Set(allGroupKeys));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allGroupKeys.length]);

    // ── Export helpers ──────────────────────────────────────────────────────
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

    const handleExport = async (forceAll = false) => {
        const groupsToUse = forceAll ? new Set(allGroupKeys) : selectedGroups;
        if (groupsToUse.size === 0) return alert("Pilih minimal satu grup data untuk dibackup.");
        if (forceAll) setSelectedGroups(new Set(allGroupKeys));
        setIsExporting(true);
        setExportSuccess(false);
        try {
            const isAll = allGroupKeys.length > 0 && allGroupKeys.every((k: string) => groupsToUse.has(k));
            const groupList = isAll ? ["all"] : [...groupsToUse];
            const blob = await exportBackup(groupList, includeImages);
            const dateStr = new Date().toISOString().split("T")[0];
            const label = isAll ? "full" : [...groupsToUse].join("-");
            const suffix = includeImages ? "" : "-dataonly";
            const filename = `pospro-backup-${label}${suffix}-${dateStr}.zip`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 4000);
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

    // ── Rclone state ────────────────────────────────────────────────────────
    const queryClient = useQueryClient();
    const { data: rcloneStatus, isLoading: rcloneLoading } = useQuery({
        queryKey: ["rclone-status"],
        queryFn: getRcloneStatus,
        refetchInterval: 15000,
    });

    const [rcloneEnabled, setRcloneEnabled] = useState(false);
    const [rcloneRemote, setRcloneRemote] = useState("");
    const [rcloneSchedule, setRcloneSchedule] = useState("0 2 * * *");
    const [rcloneKeepCount, setRcloneKeepCount] = useState(7);
    const [rcloneSaving, setRcloneSaving] = useState(false);
    const [rcloneTriggering, setRcloneTriggering] = useState(false);
    const [rcloneTriggerMsg, setRcloneTriggerMsg] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        if (rcloneStatus) {
            setRcloneEnabled(rcloneStatus.enabled ?? false);
            setRcloneRemote(rcloneStatus.remote ?? "");
            setRcloneSchedule(rcloneStatus.schedule ?? "0 2 * * *");
            setRcloneKeepCount(rcloneStatus.keepCount ?? 7);
        }
    }, [rcloneStatus?.enabled, rcloneStatus?.remote, rcloneStatus?.schedule, rcloneStatus?.keepCount]);

    const handleSaveRcloneSettings = async () => {
        setRcloneSaving(true);
        try {
            await saveRcloneSettings({ enabled: rcloneEnabled, remote: rcloneRemote.trim(), schedule: rcloneSchedule, keepCount: rcloneKeepCount });
            alert("Pengaturan rclone disimpan!");
            queryClient.invalidateQueries({ queryKey: ["rclone-status"] });
        } catch (e: any) {
            alert("Gagal: " + (e?.response?.data?.message || e.message));
        } finally {
            setRcloneSaving(false);
        }
    };

    const handleTriggerRclone = async () => {
        setRcloneTriggering(true);
        setRcloneTriggerMsg(null);
        try {
            await triggerRcloneBackup();
            setRcloneTriggerMsg({ ok: true, text: "Backup sedang diproses di background server..." });
            const prevStatus = rcloneStatus?.lastStatus;
            let attempts = 0;
            const poll = setInterval(async () => {
                attempts++;
                await queryClient.invalidateQueries({ queryKey: ["rclone-status"] });
                const fresh: any = queryClient.getQueryData(["rclone-status"]);
                if (fresh?.lastStatus && fresh.lastStatus !== prevStatus) {
                    clearInterval(poll);
                    setRcloneTriggering(false);
                    setRcloneTriggerMsg({ ok: !fresh.lastStatus.startsWith("Gagal"), text: fresh.lastStatus });
                } else if (attempts >= 20) {
                    clearInterval(poll);
                    setRcloneTriggering(false);
                }
            }, 4000);
        } catch (e: any) {
            setRcloneTriggerMsg({ ok: false, text: e?.response?.data?.message || e.message });
            setRcloneTriggering(false);
        }
    };

    const SCHEDULE_PRESETS = [
        { label: "Setiap hari jam 02:00", value: "0 2 * * *" },
        { label: "Setiap hari jam 23:00", value: "0 23 * * *" },
        { label: "Setiap 12 jam", value: "0 */12 * * *" },
        { label: "Setiap Senin jam 02:00", value: "0 2 * * 1" },
        { label: "Setiap minggu (Minggu jam 01:00)", value: "0 1 * * 0" },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 p-6">
            {/* Header */}
            <div className="flex items-start gap-3 pb-4 border-b border-border">
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Database className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Backup & Recovery</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Ekspor semua data & foto ke file ZIP, atau restore dari file backup ke sistem baru.</p>
                </div>
            </div>

            {/* ── QUICK ACTION: Backup Lengkap ─────────────────────────────── */}
            <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="font-bold text-sm text-foreground">Backup Lengkap Semua Data</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Semua grup data + foto + konfigurasi WhatsApp dalam satu file ZIP. Ideal untuk migrasi atau pindah server.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleExport(true)}
                        disabled={isExporting}
                        className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md whitespace-nowrap"
                    >
                        {isExporting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Membuat ZIP...</>
                        ) : exportSuccess ? (
                            <><CheckCircle2 className="w-4 h-4" /> Berhasil!</>
                        ) : (
                            <><Download className="w-4 h-4" /> Backup Semua Sekarang</>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                {/* ── SECTION BACKUP / EXPORT ─────────────────────────────── */}
                <div className="p-6 rounded-xl border border-border bg-background/50 shadow-sm space-y-5">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-950/40 rounded-lg">
                            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold">Ekspor Backup Pilihan</h2>
                            <p className="text-xs text-muted-foreground">Pilih grup data tertentu yang ingin disimpan.</p>
                        </div>
                    </div>

                    {/* Info isi ZIP */}
                    <div className="flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2.5 text-blue-700 dark:text-blue-400">
                        <FileArchive className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-semibold">Isi file ZIP backup:</p>
                            <p>• <strong>data.json</strong> — semua record database yang dipilih</p>
                            <p>• <strong>uploads/</strong> — semua foto produk, logo, dll.</p>
                            <p>• <strong>whatsapp_bot_config.json</strong> — grup & konfigurasi bot WA</p>
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
                        onClick={() => handleExport(false)}
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
                <div className="p-6 rounded-xl border border-border bg-background/50 shadow-sm space-y-5">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <div className="p-2 bg-green-100 dark:bg-green-950/40 rounded-lg">
                            <Upload className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold">Restore dari Backup</h2>
                            <p className="text-xs text-muted-foreground">Upload file backup <strong>.zip</strong> untuk memulihkan data, foto & config WA.</p>
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
                                    <div className="text-xs space-y-1.5 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <p className="font-semibold text-blue-700 dark:text-blue-400">Info Backup</p>
                                        <p className="text-muted-foreground">Dibuat: {new Date(restorePreview.meta.createdAt).toLocaleString('id-ID')}</p>
                                        <p className="text-muted-foreground">Aplikasi: {restorePreview.meta.app} v{restorePreview.meta.version}</p>
                                        <div className="flex flex-wrap gap-3 mt-1">
                                            {isZipFile && restorePreview.imageCount !== undefined && (
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <Image className="w-3 h-3" />
                                                    {restorePreview.imageCount} foto
                                                </span>
                                            )}
                                            {restorePreview.hasWaConfig && (
                                                <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                                                    <MessageCircle className="w-3 h-3" />
                                                    Konfigurasi WhatsApp tersedia
                                                </span>
                                            )}
                                        </div>
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
                                            <div className="grid grid-cols-4 gap-2 text-xs">
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
                                                <div className="bg-white dark:bg-muted/30 rounded-lg p-2 text-center border border-border">
                                                    <p className={`text-lg font-bold ${restoreResult.waConfigRestored ? "text-green-600" : "text-muted-foreground"}`}>
                                                        {restoreResult.waConfigRestored ? "✓" : "–"}
                                                    </p>
                                                    <p className="text-muted-foreground">Config WA</p>
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
            <div className="p-6 rounded-xl border border-border bg-background/50 shadow-sm">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" /> Panduan Backup & Recovery
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                    <div className="space-y-1.5">
                        <p className="font-semibold text-foreground">📦 Isi File ZIP Backup</p>
                        <p>File backup berisi <strong>data.json</strong> (database), folder <strong>uploads/</strong> (foto), dan <strong>whatsapp_bot_config.json</strong> (grup & setting bot WA).</p>
                    </div>
                    <div className="space-y-1.5">
                        <p className="font-semibold text-foreground">🖥️ Migrasi Sistem Baru</p>
                        <p>Klik <strong>Backup Semua Sekarang</strong> → Install PosPro di PC baru → Restore dengan mode <strong>Overwrite</strong>. Data, foto & config WA pulih otomatis.</p>
                    </div>
                    <div className="space-y-1.5">
                        <p className="font-semibold text-foreground">⚠️ Perbedaan Mode</p>
                        <p><strong>Skip Existing</strong>: tidak menimpa data yang sudah ada. <strong>Overwrite</strong>: hapus & tulis ulang. Gunakan Overwrite hanya di sistem kosong/baru.</p>
                    </div>
                    <div className="space-y-1.5">
                        <p className="font-semibold text-foreground">💬 WhatsApp Bot</p>
                        <p>Config grup WA dipulihkan otomatis dari backup. Namun <strong>QR Code perlu di-scan ulang</strong> di sistem baru karena sesi auth tidak dapat dipindahkan.</p>
                    </div>
                </div>
            </div>

            {/* ── Info tambahan ─────────────────────────────────────────────── */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <div>
                    <p className="font-semibold text-foreground mb-1">Backup file .json lama tetap bisa direstore</p>
                    <p>Format .json dari versi sebelumnya masih kompatibel. Upload file .json dan sistem akan otomatis mendeteksinya. Namun foto dan konfigurasi WhatsApp tidak akan termasuk karena format lama tidak mendukung.</p>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                RCLONE AUTO-BACKUP
            ═══════════════════════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-border bg-background/50 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg"><Server className="w-5 h-5 text-emerald-600" /></div>
                        <div>
                            <h2 className="font-semibold text-foreground">Backup Otomatis via Rclone</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Backup terjadwal disimpan ke server & disync ke cloud (GDrive, S3, Dropbox, dll) menggunakan rclone</p>
                        </div>
                    </div>
                    {rcloneStatus?.enabled && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Aktif
                        </span>
                    )}
                </div>

                <div className="p-6 space-y-6">

                    {/* Status instalasi rclone */}
                    {rcloneLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Memeriksa rclone...</div>
                    ) : rcloneStatus?.installed ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-emerald-700 font-medium">rclone terinstal</span>
                            <span className="text-muted-foreground font-mono text-xs">v{rcloneStatus.version}</span>
                        </div>
                    ) : (
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/5 border border-red-500/20 rounded-xl text-sm">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-700 font-medium">rclone tidak ditemukan di server</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Install rclone: <code className="bg-muted px-1 rounded">curl https://rclone.org/install.sh | sudo bash</code> lalu konfigurasikan remote dengan <code className="bg-muted px-1 rounded">rclone config</code></p>
                            </div>
                        </div>
                    )}

                    {/* Konfigurasi remote */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">1</span>
                            Remote Destination
                        </label>
                        <input
                            type="text"
                            value={rcloneRemote}
                            onChange={e => setRcloneRemote(e.target.value)}
                            placeholder="Contoh: gdrive:Backups/PosPro  atau  s3:mybucket/pospro"
                            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-xl outline-none focus:border-primary transition-colors font-mono"
                        />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Format: <code className="bg-muted px-1 rounded">nama-remote:path/tujuan</code>. Remote dikonfigurasi di server via <code className="bg-muted px-1 rounded">rclone config</code>.
                            Kosongkan untuk hanya simpan lokal tanpa upload.
                        </p>
                    </div>

                    {/* Jadwal */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">2</span>
                            Jadwal Otomatis
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {SCHEDULE_PRESETS.map(p => (
                                <button key={p.value} onClick={() => setRcloneSchedule(p.value)}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${rcloneSchedule === p.value ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-border bg-background text-muted-foreground hover:border-primary/30'}`}>
                                    <Clock className="w-3.5 h-3.5 shrink-0" />{p.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Cron aktif: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{rcloneSchedule}</code></p>
                    </div>

                    {/* Simpan lokal berapa file */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">3</span>
                            Simpan backup lokal (jumlah file)
                        </label>
                        <div className="flex items-center gap-3">
                            {[3, 5, 7, 14, 30].map(n => (
                                <button key={n} onClick={() => setRcloneKeepCount(n)}
                                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${rcloneKeepCount === n ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
                                    {n}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">File backup lokal di <code className="bg-muted px-1 rounded">backend/backups/</code>. File lama dihapus otomatis.</p>
                    </div>

                    {/* Toggle + Simpan */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        <button onClick={() => setRcloneEnabled(p => !p)} className="flex items-center gap-2 select-none">
                            {rcloneEnabled
                                ? <ToggleRight className="w-8 h-8 text-primary" />
                                : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                            <span className="text-sm font-medium text-foreground">
                                {rcloneEnabled ? 'Auto-backup aktif' : 'Auto-backup nonaktif'}
                            </span>
                        </button>
                        <button onClick={handleSaveRcloneSettings} disabled={rcloneSaving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm shadow-primary/20">
                            {rcloneSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Simpan Pengaturan
                        </button>
                    </div>

                    {/* Status + Trigger manual */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Backup Server Terakhir</p>
                            {rcloneStatus?.lastBackupAt ? (
                                <p className="text-sm font-medium text-foreground">
                                    {new Date(rcloneStatus.lastBackupAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            ) : <p className="text-sm text-muted-foreground">Belum pernah dijalankan</p>}
                            {rcloneStatus?.lastStatus && (
                                <p className={`text-xs mt-0.5 ${rcloneStatus.lastStatus.startsWith('Gagal') ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {rcloneStatus.lastStatus}
                                </p>
                            )}
                        </div>
                        <button onClick={handleTriggerRclone} disabled={rcloneTriggering || !rcloneStatus?.installed}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                            {rcloneTriggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            {rcloneTriggering ? "Memproses..." : "Backup Sekarang"}
                        </button>
                    </div>

                    {rcloneTriggerMsg && (
                        <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${rcloneTriggerMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                            {rcloneTriggerMsg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                            <span>{rcloneTriggerMsg.text}</span>
                        </div>
                    )}

                    {/* List file lokal */}
                    {rcloneStatus?.localBackups?.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <HardDrive className="w-3.5 h-3.5" /> File Backup Lokal ({rcloneStatus.localBackups.length})
                            </p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {rcloneStatus.localBackups.map((f: any, i: number) => (
                                    <div key={f.name} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${i === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'}`}>
                                        <span className="font-mono text-foreground truncate">{f.name}</span>
                                        <span className="text-muted-foreground shrink-0 ml-2">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

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
                            {restorePreview?.hasWaConfig && (
                                <span> Konfigurasi WhatsApp juga akan dipulihkan.</span>
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
