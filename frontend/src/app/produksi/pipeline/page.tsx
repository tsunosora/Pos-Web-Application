"use client";

import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api/client";
import {
    DndContext, DragEndEvent, DragStartEvent, DragOverlay,
    PointerSensor, TouchSensor, useSensor, useSensors,
    rectIntersection, MeasuringStrategy,
    useDroppable, useDraggable,
} from "@dnd-kit/core";
import {
    getPipelineJobs, updatePipelineStage, uploadPipelineProofImage,
    deletePipelineProof, deletePipelineJob, cancelPipelineJob, resolvePhotoUrl,
    summarizeDesignersFromJobs,
    type PipelineJob, type PipelineStage,
    PIPELINE_STAGES, PIPELINE_STAGE_LABEL,
} from "@/lib/api/production";
import { getPublicDesigners } from "@/lib/api/designers";
import { AssignDesignerModal } from "@/components/produksi/AssignDesignerModal";
import { DesignerPipelinePanel } from "@/components/produksi/DesignerPipelinePanel";
import Link from "next/link";
import {
    Clock, User, GripVertical, AlertTriangle, Loader2, X,
    Upload, FileText, ImageIcon, Trash2, ChevronLeft, ChevronRight, Search, Calendar,
    Share2, Copy, Check, Pen, Zap, Ban, Shirt, Package,
} from "lucide-react";
import { badgeToneClass } from "@/components/ui/status-badge";
import { WorkOrderModal } from "@/components/produksi/WorkOrderModal";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

const COLUMN_STYLE: Record<PipelineStage, { color: string; bg: string }> = {
    DESIGN:        { color: "text-foreground",  bg: "bg-muted/50 border-border" },
    ACC:           { color: "text-orange-700",  bg: "bg-orange-50 border-orange-200" },
    PRINT:         { color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
    ANTRIAN_PRESS: { color: "text-cyan-700",    bg: "bg-cyan-50 border-cyan-200" },
    JAHIT:         { color: "text-purple-700",  bg: "bg-purple-50 border-purple-200" },
    QC_PACKING:    { color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
    KIRIM:         { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    RETUR:         { color: "text-red-700",     bg: "bg-red-50 border-red-200" },
    SELESAI:       { color: "text-foreground",    bg: "bg-muted border-border" },
};

const PRIORITY_BADGE: Record<string, string> = {
    URGENT: badgeToneClass.danger,
    HIGH: badgeToneClass.warning,
    NORMAL: badgeToneClass.neutral,
    LOW: badgeToneClass.info,
};

// Helper: dapatkan list proof images (gabungan proofs[] baru + proofImageUrl legacy)
function getProofList(job: PipelineJob): { id?: number; filename: string }[] {
    if (job.proofs && job.proofs.length > 0) {
        return job.proofs.map(p => ({ id: p.id, filename: p.filename }));
    }
    if (job.proofImageUrl) return [{ filename: job.proofImageUrl }];
    return [];
}

export default function ProduksiPipelinePage() {
    const qc = useQueryClient();
    const [activeJobId, setActiveJobId] = useState<number | null>(null);
    const [jahitModal, setJahitModal] = useState<{ job: PipelineJob; targetStage: PipelineStage } | null>(null);
    const [returModal, setReturModal] = useState<{ job: PipelineJob } | null>(null);
    const [cancelModal, setCancelModal] = useState<{ job: PipelineJob } | null>(null);
    const [proofViewer, setProofViewer] = useState<{ job: PipelineJob } | null>(null);
    const [assignProof, setAssignProof] = useState<{ jobId: number; files: File[] } | null>(null);
    const [woModalJob, setWoModalJob] = useState<{ id: number; jobNumber: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterPriority, setFilterPriority] = useState<string>("ALL");
    const [filterDate, setFilterDate] = useState<"ALL" | "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "OVERDUE">("ALL");
    const [filterDesigner, setFilterDesigner] = useState<string>("ALL");
    const [showShare, setShowShare] = useState(false);
    const shareRef = useRef<HTMLDivElement>(null);

    const { data: designers = [] } = useQuery({
        queryKey: ["public-designers"],
        queryFn: getPublicDesigners,
        staleTime: 5 * 60_000,
    });

    const { data: jobs = [], isLoading } = useQuery({
        queryKey: ["produksi-pipeline"],
        queryFn: getPipelineJobs,
        // Pause refetch saat ada card sedang di-drag
        refetchInterval: activeJobId !== null ? false : 60_000,
        refetchOnWindowFocus: false,
    });

    const stageMut = useMutation({
        mutationFn: (data: { id: number; payload: Parameters<typeof updatePipelineStage>[1] }) =>
            updatePipelineStage(data.id, data.payload),
        // Optimistic update: langsung update UI sebelum server respond
        onMutate: async (data) => {
            await qc.cancelQueries({ queryKey: ["produksi-pipeline"] });
            const prev = qc.getQueryData<PipelineJob[]>(["produksi-pipeline"]);
            qc.setQueryData<PipelineJob[]>(["produksi-pipeline"], (old) => {
                if (!old) return old;
                return old.map(j => j.id === data.id ? { ...j, ...data.payload } as PipelineJob : j);
            });
            return { prev };
        },
        // Rollback kalau server error — refetch biar state sinkron kembali
        onError: (_err, _data, ctx) => {
            if (ctx?.prev) qc.setQueryData(["produksi-pipeline"], ctx.prev);
            qc.invalidateQueries({ queryKey: ["produksi-pipeline"] });
        },
        // Tidak invalidate di onSettled — optimistic update sudah handle UI.
        // Background refetch tiap 60s cukup untuk eventual consistency.
    });

    const uploadMut = useMutation({
        mutationFn: (data: { id: number; file: File; designerName?: string }) =>
            uploadPipelineProofImage(data.id, data.file, data.designerName),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["produksi-pipeline"] }),
    });

    const deleteProofMut = useMutation({
        mutationFn: (proofId: number) => deletePipelineProof(proofId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["produksi-pipeline"] }),
    });

    const deleteJobMut = useMutation({
        mutationFn: (jobId: number) => deletePipelineJob(jobId),
        onMutate: async (jobId) => {
            await qc.cancelQueries({ queryKey: ["produksi-pipeline"] });
            const prev = qc.getQueryData<PipelineJob[]>(["produksi-pipeline"]);
            qc.setQueryData<PipelineJob[]>(["produksi-pipeline"], old => old?.filter(j => j.id !== jobId));
            return { prev };
        },
        onError: (_err, _id, ctx) => {
            if (ctx?.prev) qc.setQueryData(["produksi-pipeline"], ctx.prev);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: ["produksi-pipeline"] }),
    });

    const handleDeleteJob = useCallback((jobId: number) => {
        deleteJobMut.mutate(jobId);
    }, [deleteJobMut]);

    const cancelJobMut = useMutation({
        mutationFn: (data: { jobId: number; reason: string }) => cancelPipelineJob(data.jobId, true, data.reason),
        onMutate: async (data) => {
            await qc.cancelQueries({ queryKey: ["produksi-pipeline"] });
            const prev = qc.getQueryData<PipelineJob[]>(["produksi-pipeline"]);
            // Job batal langsung hilang dari kanban (optimistic)
            qc.setQueryData<PipelineJob[]>(["produksi-pipeline"], old => old?.filter(j => j.id !== data.jobId));
            return { prev };
        },
        onError: (_err, _data, ctx) => {
            if (ctx?.prev) qc.setQueryData(["produksi-pipeline"], ctx.prev);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: ["produksi-pipeline"] }),
    });

    const handleOpenCancel = useCallback((job: PipelineJob) => {
        setCancelModal({ job });
    }, []);

    // Pilih file dulu → buka modal "assign desainer", upload setelah dipilih
    const handleUploadProof = useCallback((jobId: number, files: FileList) => {
        setAssignProof({ jobId, files: Array.from(files) });
    }, []);

    const doUploadProof = useCallback((designerName?: string) => {
        setAssignProof(prev => {
            if (prev) prev.files.forEach((file) => uploadMut.mutate({ id: prev.jobId, file, designerName }));
            return null;
        });
    }, [uploadMut]);

    const handleDeleteProof = useCallback((proofId: number) => {
        deleteProofMut.mutate(proofId);
    }, [deleteProofMut]);

    const handleOpenProofViewer = useCallback((job: PipelineJob) => {
        setProofViewer({ job });
    }, []);

    const handleOpenWO = useCallback((job: PipelineJob) => {
        setWoModalJob({ id: job.id, jobNumber: job.jobNumber });
    }, []);

    const currentProofViewerJob = useMemo(() => {
        if (!proofViewer) return null;
        return jobs.find(j => j.id === proofViewer.job.id) || proofViewer.job;
    }, [proofViewer, jobs]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    // useDeferredValue: input search tetap responsif, filter recompute saat browser idle
    const deferredSearch = useDeferredValue(searchQuery);

    const grouped = useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        const now = dayjs();
        const startOfToday = now.startOf("day");
        const startOfWeek = now.startOf("week");
        const startOfMonth = now.startOf("month");

        const g: Record<PipelineStage, PipelineJob[]> = {
            DESIGN: [], ACC: [], PRINT: [], ANTRIAN_PRESS: [], JAHIT: [],
            QC_PACKING: [], KIRIM: [], RETUR: [], SELESAI: [],
        };
        for (const j of jobs) {
            // Filter prioritas
            if (filterPriority !== "ALL" && (j.priority || "NORMAL") !== filterPriority) continue;

            // Filter designer
            if (filterDesigner !== "ALL") {
                if (filterDesigner === "__UNASSIGNED__") {
                    if (j.designerName) continue;
                } else {
                    if (j.designerName !== filterDesigner) continue;
                }
            }

            // Filter tanggal berdasarkan createdAt / deadline
            if (filterDate !== "ALL") {
                if (filterDate === "OVERDUE") {
                    // Job lewat deadline, belum di stage terminal
                    const done = j.pipelineStage === "SELESAI" || j.pipelineStage === "KIRIM";
                    if (done || !j.deadline || !dayjs(j.deadline).isBefore(now, "day")) continue;
                } else {
                    const created = j.createdAt ? dayjs(j.createdAt) : null;
                    if (!created) continue;
                    if (filterDate === "TODAY" && !created.isSame(startOfToday, "day")) continue;
                    if (filterDate === "THIS_WEEK" && created.isBefore(startOfWeek)) continue;
                    if (filterDate === "THIS_MONTH" && created.isBefore(startOfMonth)) continue;
                }
            }

            // Filter pencarian
            if (q) {
                const match =
                    (j.transaction?.customerName ?? "").toLowerCase().includes(q) ||
                    (j.transaction?.invoiceNumber ?? "").toLowerCase().includes(q) ||
                    (j.jobNumber ?? "").toLowerCase().includes(q);
                if (!match) continue;
            }

            const s = (j.pipelineStage || "DESIGN") as PipelineStage;
            (g[s] || g.DESIGN).push(j);
        }
        return g;
    }, [jobs, deferredSearch, filterPriority, filterDate, filterDesigner]);

    const handleDragStart = useCallback((e: DragStartEvent) => {
        setActiveJobId(Number(e.active.id));
    }, []);

    const handleDragEnd = useCallback((e: DragEndEvent) => {
        setActiveJobId(null);
        if (!e.over) return;
        const jobId = Number(e.active.id);
        const newStage = e.over.id as PipelineStage;
        const job = jobs.find(j => j.id === jobId);
        if (!job || (job.pipelineStage || "DESIGN") === newStage) return;

        if (newStage === "JAHIT") {
            setJahitModal({ job, targetStage: newStage });
            return;
        }
        if (newStage === "RETUR") {
            setReturModal({ job });
            return;
        }
        stageMut.mutate({ id: jobId, payload: { pipelineStage: newStage } });
    }, [jobs, stageMut]);

    const designerOptions = useMemo(() => {
        const names = new Set<string>();
        for (const j of jobs) {
            if (j.designerName) names.add(j.designerName);
        }
        return Array.from(names).sort();
    }, [jobs]);

    // Ringkasan desainer dihitung dari isi pipeline (ikut update optimistic saat drag).
    const designerSummary = useMemo(() => summarizeDesignersFromJobs(jobs), [jobs]);

    const totalFiltered = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
    const totalAll = jobs.length;
    const isFiltering = deferredSearch.trim() !== "" || filterPriority !== "ALL" || filterDate !== "ALL" || filterDesigner !== "ALL";

    return (
        <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-lg sm:text-xl font-bold text-foreground">Pipeline Produksi</h1>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Drag &amp; drop card antar kolom. Tap-hold di mobile.
                        {isFiltering && (
                            <span className="ml-1.5 text-indigo-600 font-semibold">
                                · Menampilkan {totalFiltered} dari {totalAll} job
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isLoading && <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />}
                    {/* Share link ke halaman produksi operator */}
                    <div className="relative" ref={shareRef}>
                        <button
                            onClick={() => setShowShare(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                            <Share2 className="h-3.5 w-3.5" /> Bagikan Link
                        </button>
                        {showShare && (
                            <SharePopover onClose={() => setShowShare(false)} />
                        )}
                    </div>
                </div>
            </div>

            {/* Filter bar */}
            <div className="space-y-2">
                {/* Baris 1: Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Cari pelanggan, no. invoice, no. job..."
                        className="w-full pl-8 pr-8 py-1.5 bg-card border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Baris 2: Filter Tanggal + Prioritas + Reset */}
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Filter Tanggal */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                        {([
                            { key: "ALL",        label: "Semua" },
                            { key: "TODAY",      label: "Hari Ini" },
                            { key: "THIS_WEEK",  label: "Minggu Ini" },
                            { key: "THIS_MONTH", label: "Bulan Ini" },
                            { key: "OVERDUE",    label: "Lewat Deadline" },
                        ] as const).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setFilterDate(key)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                    filterDate === key
                                        ? key === "OVERDUE"
                                            ? "bg-red-600 text-white border-red-600"
                                            : "bg-indigo-600 text-white border-indigo-600"
                                        : key === "OVERDUE"
                                            ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                            : "bg-card text-muted-foreground border-border hover:bg-muted"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="w-px h-4 bg-border self-center hidden sm:block" />

                    {/* Filter Prioritas */}
                    <div className="flex gap-1 flex-wrap">
                        {(["ALL", "URGENT", "HIGH", "NORMAL", "LOW"] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setFilterPriority(p)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                    filterPriority === p
                                        ? p === "URGENT" ? "bg-red-600 text-white border-red-600"
                                        : p === "HIGH" ? "bg-orange-500 text-white border-orange-500"
                                        : p === "LOW" ? "bg-sky-500 text-white border-sky-500"
                                        : p === "NORMAL" ? "bg-gray-600 text-white border-gray-600"
                                        : "bg-indigo-600 text-white border-indigo-600"
                                        : p === "URGENT" ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                        : p === "HIGH" ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                                        : p === "LOW" ? "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
                                        : p === "NORMAL" ? "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                                }`}
                            >
                                {p === "ALL" ? "Semua" : p}
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="w-px h-4 bg-border self-center hidden sm:block" />

                    {/* Filter Designer */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <Pen className="w-3 h-3 text-muted-foreground shrink-0" />
                        <button
                            onClick={() => setFilterDesigner("ALL")}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                filterDesigner === "ALL"
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                            }`}
                        >
                            Semua
                        </button>
                        <button
                            onClick={() => setFilterDesigner("__UNASSIGNED__")}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                filterDesigner === "__UNASSIGNED__"
                                    ? "bg-gray-600 text-white border-gray-600"
                                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                            }`}
                        >
                            Belum Assign
                        </button>
                        {designerOptions.map(name => (
                            <button
                                key={name}
                                onClick={() => setFilterDesigner(name)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                    filterDesigner === name
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                }`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>

                    {isFiltering && (
                        <button
                            onClick={() => { setSearchQuery(""); setFilterPriority("ALL"); setFilterDate("ALL"); setFilterDesigner("ALL"); }}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline whitespace-nowrap ml-auto"
                        >
                            Reset filter
                        </button>
                    )}
                </div>
            </div>

            <DesignerPipelinePanel rows={designerSummary} />

            <DndContext
                sensors={sensors}
                collisionDetection={rectIntersection}
                measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => { setActiveJobId(null); }}
            >
                {/* Horizontal scroll di mobile, grid 4/8 kolom di desktop */}
                <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none">
                    {PIPELINE_STAGES.map((stage) => (
                        <Column
                            key={stage}
                            stage={stage}
                            jobs={grouped[stage]}
                            activeJobId={activeJobId}
                            onUploadProof={handleUploadProof}
                            onOpenProofViewer={handleOpenProofViewer}
                            onOpenWO={handleOpenWO}
                            onDeleteJob={handleDeleteJob}
                            onCancelJob={handleOpenCancel}
                            onToggleExpress={(jobId, val) => stageMut.mutate({ id: jobId, payload: { isExpress: val } })}
                            onUpdateDesigner={(jobId, name) => stageMut.mutate({ id: jobId, payload: { designerName: name } })}
                            uploading={uploadMut.isPending}
                        />
                    ))}
                </div>
                {/* Portal-rendered overlay supaya tidak ke-clip kolom overflow.
                    Pakai DragPreview yang lightweight (tanpa image/link/upload) supaya drag tetap smooth. */}
                <DragOverlay dropAnimation={null}>
                    {activeJobId != null && (() => {
                        const j = jobs.find(x => x.id === activeJobId);
                        return j ? <DragPreview job={j} /> : null;
                    })()}
                </DragOverlay>
            </DndContext>

            {jahitModal && (
                <JahitModal
                    job={jahitModal.job}
                    onClose={() => setJahitModal(null)}
                    onSubmit={(payload) => {
                        stageMut.mutate({
                            id: jahitModal.job.id,
                            payload: { pipelineStage: "JAHIT", ...payload },
                        });
                        setJahitModal(null);
                    }}
                    submitting={stageMut.isPending}
                />
            )}

            {returModal && (
                <ReturModal
                    job={returModal.job}
                    onClose={() => setReturModal(null)}
                    onSubmit={(reason) => {
                        stageMut.mutate({
                            id: returModal.job.id,
                            payload: { pipelineStage: "RETUR", returnReason: reason },
                        });
                        setReturModal(null);
                    }}
                    submitting={stageMut.isPending}
                />
            )}

            {cancelModal && (
                <CancelModal
                    job={cancelModal.job}
                    onClose={() => setCancelModal(null)}
                    onSubmit={(reason) => {
                        cancelJobMut.mutate({ jobId: cancelModal.job.id, reason });
                        setCancelModal(null);
                    }}
                    submitting={cancelJobMut.isPending}
                />
            )}

            {currentProofViewerJob && proofViewer && (
                <ProofViewer
                    job={currentProofViewerJob}
                    onClose={() => setProofViewer(null)}
                    onUpload={handleUploadProof}
                    onDelete={handleDeleteProof}
                    uploading={uploadMut.isPending}
                    deleting={deleteProofMut.isPending}
                />
            )}

            {assignProof && (
                <AssignDesignerModal
                    designers={designers}
                    fileCount={assignProof.files.length}
                    defaultName={jobs.find(j => j.id === assignProof.jobId)?.designerName || ""}
                    onPick={(name) => doUploadProof(name || undefined)}
                    onCancel={() => setAssignProof(null)}
                />
            )}

            {woModalJob && (
                <WorkOrderModal
                    jobId={woModalJob.id}
                    jobNumber={woModalJob.jobNumber}
                    onClose={() => setWoModalJob(null)}
                />
            )}
        </div>
    );
}

// ─── Share Popover ─────────────────────────────────────────────────────────

function SharePopover({ onClose }: { onClose: () => void }) {
    const [copied, setCopied] = useState<string | null>(null);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const links = [
        { label: "Board Operator", desc: "Untuk desainer & operator mesin", path: "/produksi/board" },
        { label: "Antrian Produksi", desc: "Tampilan antrian + status job", path: "/produksi" },
    ];

    const copy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(url);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            // fallback
            const el = document.createElement("textarea");
            el.value = url;
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
            setCopied(url);
            setTimeout(() => setCopied(null), 2000);
        }
    };

    const share = async (url: string, label: string) => {
        if (navigator.share) {
            await navigator.share({ title: `PosPro — ${label}`, url });
        } else {
            copy(url);
        }
    };

    return (
        <>
            {/* overlay untuk close klik luar */}
            <div className="fixed inset-0 z-[40]" onClick={onClose} />
            <div className="absolute right-0 top-full mt-2 z-[50] w-80 bg-card rounded-xl shadow-2xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm text-foreground">Bagikan ke Operator / Desainer</p>
                    <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <p className="text-[11px] text-muted-foreground">Halaman berikut bisa diakses tanpa login — cukup masukkan PIN operator.</p>
                {links.map(({ label, desc, path }) => {
                    const url = `${origin}${path}`;
                    const isCopied = copied === url;
                    return (
                        <div key={path} className="rounded-lg border border-border p-3 space-y-1.5">
                            <div>
                                <p className="text-xs font-semibold text-foreground">{label}</p>
                                <p className="text-[10px] text-muted-foreground">{desc}</p>
                            </div>
                            <div className="flex items-center gap-1 bg-muted rounded px-2 py-1 border border-border">
                                <span className="text-[10px] text-muted-foreground font-mono truncate flex-1">{url}</span>
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => copy(url)}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-semibold transition-colors ${isCopied ? "bg-emerald-100 text-emerald-700" : "bg-muted hover:bg-muted/70 text-foreground"}`}
                                >
                                    {isCopied ? <><Check className="h-3 w-3" /> Tersalin!</> : <><Copy className="h-3 w-3" /> Salin Link</>}
                                </button>
                                <button
                                    onClick={() => share(url, label)}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold transition-colors"
                                >
                                    <Share2 className="h-3 w-3" /> Bagikan
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

// ─── Column ────────────────────────────────────────────────────────────────

const Column = memo(function Column({
    stage, jobs, activeJobId, onUploadProof, onOpenProofViewer, onOpenWO, onDeleteJob, onCancelJob, onToggleExpress, onUpdateDesigner, uploading,
}: {
    stage: PipelineStage;
    jobs: PipelineJob[];
    activeJobId: number | null;
    onUploadProof: (jobId: number, files: FileList) => void;
    onOpenProofViewer: (job: PipelineJob) => void;
    onOpenWO: (job: PipelineJob) => void;
    onDeleteJob: (jobId: number) => void;
    onCancelJob: (job: PipelineJob) => void;
    onToggleExpress: (jobId: number, val: boolean) => void;
    onUpdateDesigner: (jobId: number, name: string | null) => void;
    uploading: boolean;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: stage });
    const style = COLUMN_STYLE[stage];
    return (
        <div
            ref={setNodeRef}
            className={`flex-shrink-0 w-[78vw] sm:w-auto rounded-xl border-2 ${style.bg} ${isOver ? "ring-2 ring-indigo-400" : ""} min-h-[300px] flex flex-col snap-start`}
        >
            <div className={`px-2 sm:px-3 py-2 border-b font-bold text-xs sm:text-sm ${style.color} flex items-center justify-between sticky top-0 bg-inherit z-10`}>
                <span className="truncate">{PIPELINE_STAGE_LABEL[stage]}</span>
                <span className="text-[10px] sm:text-xs bg-white/70 px-1.5 sm:px-2 py-0.5 rounded-full">{jobs.length}</span>
            </div>
            <div className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 flex-1 overflow-y-auto max-h-[60vh] sm:max-h-[72vh]">
                {jobs.length === 0 ? (
                    <p className="text-[10px] sm:text-xs text-muted-foreground text-center py-6 italic">— kosong —</p>
                ) : (
                    jobs.map((job) => (
                        <KanbanCard
                            key={job.id}
                            job={job}
                            isActive={activeJobId === job.id}
                            onUploadProof={onUploadProof}
                            onOpenProofViewer={onOpenProofViewer}
                            onOpenWO={onOpenWO}
                            onDeleteJob={onDeleteJob}
                            onCancelJob={onCancelJob}
                            onToggleExpress={onToggleExpress}
                            onUpdateDesigner={onUpdateDesigner}
                            uploading={uploading}
                        />
                    ))
                )}
            </div>
        </div>
    );
});

// ─── Card: thin draggable wrapper ─────────────────────────────────────────
// Sengaja dipisah dari KanbanCardInner. useDraggable subscribe ke DnD context,
// artinya komponen ini re-render setiap pointer move saat drag. Tapi render-nya
// cuma sebuah <div> kosong — sangat murah. KanbanCardInner di bawah yang punya
// semua JSX berat di-memo secara terpisah dan tidak akan re-render selama drag.

const KanbanCard = memo(function KanbanCard({
    job, isActive, onUploadProof, onOpenProofViewer, onOpenWO, onDeleteJob, onCancelJob, onToggleExpress, onUpdateDesigner, uploading,
}: {
    job: PipelineJob;
    isActive: boolean;
    onUploadProof: (jobId: number, files: FileList) => void;
    onOpenProofViewer: (job: PipelineJob) => void;
    onOpenWO: (job: PipelineJob) => void;
    onDeleteJob: (jobId: number) => void;
    onCancelJob: (job: PipelineJob) => void;
    onToggleExpress: (jobId: number, val: boolean) => void;
    onUpdateDesigner: (jobId: number, name: string | null) => void;
    uploading: boolean;
}) {
    const { attributes, listeners, setNodeRef } = useDraggable({ id: String(job.id) });
    return (
        <div ref={setNodeRef} {...attributes} {...listeners} style={{ touchAction: "none" }}>
            <KanbanCardInner
                job={job}
                isActive={isActive}
                onUploadProof={onUploadProof}
                onOpenProofViewer={onOpenProofViewer}
                onOpenWO={onOpenWO}
                onDeleteJob={onDeleteJob}
                onCancelJob={onCancelJob}
                onToggleExpress={onToggleExpress}
                onUpdateDesigner={onUpdateDesigner}
                uploading={uploading}
            />
        </div>
    );
});

// ─── Design urgency helper ────────────────────────────────────────────────
// Berapa hari job sudah menunggu proof. Hanya relevan di stage DESIGN tanpa proof.
// Skala: Aman (0-1h) · Normal (2-3h) · Urgent (4h+)
type UrgencyLevel = "aman" | "normal" | "urgent";
interface DesignUrgency { label: string; days: number; level: UrgencyLevel }

function getDesignUrgency(createdAt: string | null | undefined): DesignUrgency | null {
    if (!createdAt) return null;
    const days = dayjs().diff(dayjs(createdAt), "day");
    if (days <= 1) return { label: "Aman", days, level: "aman" };
    if (days <= 3) return { label: "Normal", days, level: "normal" };
    return { label: "Urgent", days, level: "urgent" };
}

const URGENCY_STRIP: Record<UrgencyLevel, string> = {
    aman:   "border-emerald-200 bg-emerald-50 text-emerald-700",
    normal: "border-amber-300 bg-amber-50 text-amber-700",
    urgent: "border-red-300 bg-red-50 text-red-700",
};

const URGENCY_UPLOAD_BTN: Record<UrgencyLevel, string> = {
    aman:   "border-border hover:border-emerald-400 hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600",
    normal: "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100",
    urgent: "border-red-400 bg-red-50 text-red-700 hover:bg-red-100 animate-pulse",
};

// ─── Card: heavy content (memoized, zero dnd hooks) ───────────────────────
// Tidak ada useDraggable/useDroppable → tidak subscribe ke DnD context.
// Saat pointer move selama drag, props komponen ini tidak berubah (isActive
// hanya berubah saat drag start/end, bukan saat move) → React.memo bail out
// → zero re-render selama drag. Ini sumber percepatan utama.

const KanbanCardInner = memo(function KanbanCardInner({
    job, isActive, onUploadProof, onOpenProofViewer, onOpenWO, onDeleteJob, onCancelJob, onToggleExpress, onUpdateDesigner, uploading,
}: {
    job: PipelineJob;
    isActive: boolean;
    onUploadProof: (jobId: number, files: FileList) => void;
    onOpenProofViewer: (job: PipelineJob) => void;
    onOpenWO: (job: PipelineJob) => void;
    onDeleteJob: (jobId: number) => void;
    onCancelJob: (job: PipelineJob) => void;
    onToggleExpress: (jobId: number, val: boolean) => void;
    onUpdateDesigner: (jobId: number, name: string | null) => void;
    uploading: boolean;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const isDesign = (job.pipelineStage || "DESIGN") === "DESIGN";
    const proofs = getProofList(job);

    const productName = job.transactionItem?.productVariant?.product?.name
        || job.transactionItem?.productVariant?.variantName
        || "—";
    const customerName = job.transaction?.customerName || "—";
    const qty = job.transactionItem?.quantity ?? 0;
    const dim = job.transactionItem?.widthCm && job.transactionItem?.heightCm
        ? `${job.transactionItem.widthCm}×${job.transactionItem.heightCm}cm`
        : null;

    const needsProof = isDesign && proofs.length === 0;
    const designUrgency = needsProof ? getDesignUrgency(job.createdAt) : null;
    const firstProof = proofs[0] ? resolvePhotoUrl(proofs[0].filename) : null;

    const jahitLate = job.pipelineStage === "JAHIT"
        && job.jahitEstimate
        && dayjs(job.jahitEstimate).isBefore(dayjs());

    const deadlineLate = job.deadline && dayjs(job.deadline).isBefore(dayjs())
        && job.pipelineStage !== "SELESAI" && job.pipelineStage !== "KIRIM";

    return (
        <div
            className={`bg-card rounded-lg shadow-sm border p-1.5 sm:p-2 text-[11px] sm:text-xs cursor-grab active:cursor-grabbing select-none ${isActive ? "opacity-30" : ""} ${jahitLate ? "border-red-400 bg-red-50" : job.isExpress ? "border-orange-400" : "border-border"}`}
        >
            <div className="flex items-start justify-between gap-1 mb-1">
                <span className="font-mono font-bold text-[9px] sm:text-[10px] text-muted-foreground truncate">{job.jobNumber}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {confirmDelete ? (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDeleteJob(job.id); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="text-[9px] px-1.5 py-0.5 bg-red-600 text-white rounded font-semibold"
                            >Hapus</button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="text-[9px] px-1.5 py-0.5 bg-muted text-foreground rounded"
                            >Batal</button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCancelJob(job); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                title="Tandai batal / klien tidak jadi order"
                                className="text-muted-foreground hover:text-amber-600 transition-colors"
                            >
                                <Ban className="h-3 w-3" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                title="Hapus job"
                                className="text-muted-foreground hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </>
                    )}
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
            </div>

            <div className="flex items-center gap-1 flex-wrap mb-1">
                {job.isExpress && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-orange-400 bg-orange-100 text-orange-700 text-[9px] font-bold">
                        <Zap className="h-2.5 w-2.5" /> EXPRESS
                    </span>
                )}
                {job.priority && job.priority !== "NORMAL" && (
                    <span className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-semibold ${PRIORITY_BADGE[job.priority] || PRIORITY_BADGE.NORMAL}`}>
                        {job.priority}
                    </span>
                )}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleExpress(job.id, !job.isExpress); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title={job.isExpress ? "Batalkan express" : "Tandai sebagai express"}
                    className={`ml-auto text-[9px] flex items-center gap-0.5 px-1.5 py-0.5 rounded border transition-colors ${
                        job.isExpress
                            ? "border-orange-300 text-orange-600 hover:bg-orange-100"
                            : "border-border text-muted-foreground hover:text-orange-500 hover:border-orange-300"
                    }`}
                >
                    <Zap className="h-2.5 w-2.5" />
                </button>
            </div>

            <div className="font-semibold text-foreground line-clamp-2 leading-tight mb-1">
                {productName}
            </div>

            <div className="text-muted-foreground space-y-0.5">
                <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{customerName}</span>
                </div>
                <DesignerInlineEdit
                    designerName={job.designerName}
                    onSave={(name) => onUpdateDesigner(job.id, name)}
                />
                <div className="text-muted-foreground">
                    {qty} pcs{dim && ` · ${dim}`}
                </div>
                {job.transaction?.id && (
                    <Link
                        href={`/transactions/${job.transaction.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-mono truncate"
                    >
                        <FileText className="h-2.5 w-2.5 flex-shrink-0" />
                        {job.transaction.invoiceNumber || `#${job.transaction.id}`}
                    </Link>
                )}
                {deadlineLate && (
                    <div className="flex items-center gap-1 text-red-700 font-semibold">
                        <AlertTriangle className="h-3 w-3" /> Lewat deadline
                    </div>
                )}
                {job.deadline && !deadlineLate && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" /> {dayjs(job.deadline).format("DD MMM")}
                    </div>
                )}
            </div>

            {firstProof ? (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenProofViewer(job); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="mt-1.5 relative w-full block"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={firstProof}
                        alt="Proof"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-16 sm:h-20 object-cover rounded border border-emerald-300"
                    />
                    <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                        <ImageIcon className="h-2.5 w-2.5" />
                        {proofs.length > 1 ? `${proofs.length}x` : "ACC"}
                    </span>
                </button>
            ) : isDesign ? (
                <div className="mt-1.5 space-y-1">
                    {designUrgency && (
                        <div className={`flex items-center justify-between px-2 py-1 rounded border text-[9px] font-semibold ${URGENCY_STRIP[designUrgency.level]}`}>
                            <span>
                                {designUrgency.days === 0 ? "Masuk hari ini" : `Masuk ${designUrgency.days} hari lalu`}
                            </span>
                            <span className="font-bold tracking-wide">{designUrgency.label.toUpperCase()}</span>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files;
                            if (f && f.length > 0) onUploadProof(job.id, f);
                            e.target.value = "";
                        }}
                    />
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        disabled={uploading}
                        className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 border-2 border-dashed rounded text-[10px] font-semibold disabled:opacity-50 transition-colors ${designUrgency ? URGENCY_UPLOAD_BTN[designUrgency.level] : URGENCY_UPLOAD_BTN.aman}`}
                    >
                        {uploading ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Uploading...</>
                        ) : (
                            <><Upload className="h-3 w-3" /> Upload Proof</>
                        )}
                    </button>
                </div>
            ) : null}

            {job.pipelineStage === "JAHIT" && (job.penjahitName || job.jahitEstimate) && (
                <div className={`mt-1.5 pt-1.5 border-t text-[10px] ${jahitLate ? "border-red-200 text-red-700 font-semibold" : "border-border/60 text-muted-foreground"}`}>
                    {job.penjahitName && <div className="flex items-center gap-1 truncate"><Shirt className="h-2.5 w-2.5 shrink-0" /> {job.penjahitName}</div>}
                    {job.jahitEstimate && (
                        <div className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Est: {dayjs(job.jahitEstimate).format("DD MMM")}
                            {jahitLate && <AlertTriangle className="h-3 w-3 ml-auto" />}
                        </div>
                    )}
                </div>
            )}

            {job.pipelineStage === "RETUR" && job.returnReason && (
                <div className="mt-1.5 pt-1.5 border-t border-red-200 text-[10px] text-red-700 line-clamp-2 flex items-start gap-1">
                    <Package className="h-2.5 w-2.5 shrink-0 mt-0.5" /> {job.returnReason}
                </div>
            )}

            {/* Work Order — muncul setelah desain ACC (stage bukan DESIGN). */}
            {(job.pipelineStage || "DESIGN") !== "DESIGN" && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenWO(job); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold transition-colors"
                >
                    <FileText className="h-3 w-3" /> Work Order
                </button>
            )}
        </div>
    );
});

// ─── Drag Preview (lightweight, untuk DragOverlay) ────────────────────────
// Hanya render summary minimum supaya drag tetap smooth — image & link skip.

// ─── Designer Inline Edit ──────────────────────────────────────────────────
// Klik ikon pensil → dropdown designer terdaftar muncul.
// useQuery dengan key ['designers-list'] di-deduplicate oleh React Query —
// satu request untuk semua card, shared via cache.

function DesignerInlineEdit({
    designerName, onSave,
}: {
    designerName: string | null;
    onSave: (name: string | null) => void;
}) {
    const [editing, setEditing] = useState(false);
    const selectRef = useRef<HTMLSelectElement>(null);

    const { data: designers = [] } = useQuery({
        queryKey: ["designers-list"],
        queryFn: async () => (await api.get("/designers")).data as { id: number; name: string; isActive: boolean }[],
        staleTime: 5 * 60_000,
    });
    const activeDesigners = designers.filter(d => d.isActive);

    const open = () => {
        setEditing(true);
        setTimeout(() => selectRef.current?.focus(), 50);
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setEditing(false);
        const val = e.target.value || null;
        if (val !== designerName) onSave(val);
    };

    const cancel = () => setEditing(false);

    if (editing) {
        return (
            <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                <Pen className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                <select
                    ref={selectRef}
                    defaultValue={designerName || ""}
                    onChange={handleChange}
                    onBlur={cancel}
                    className="flex-1 min-w-0 text-[10px] px-1 py-0.5 border border-indigo-300 rounded outline-none focus:ring-1 focus:ring-indigo-400 bg-card"
                >
                    <option value="">— Kosongkan —</option>
                    {activeDesigners.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                </select>
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); cancel(); }}
                    className="text-muted-foreground hover:text-muted-foreground"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 group/designer">
            <Pen className="h-3 w-3 text-indigo-400 flex-shrink-0" />
            {designerName ? (
                <span className="truncate text-indigo-700 font-medium text-[11px]">{designerName}</span>
            ) : (
                <span className="text-muted-foreground italic text-[10px]">Belum assign</span>
            )}
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); open(); }}
                onMouseDown={(e) => e.preventDefault()}
                title="Ubah designer"
                className="ml-auto opacity-0 group-hover/designer:opacity-100 transition-opacity text-muted-foreground hover:text-indigo-600"
            >
                <Pen className="h-2.5 w-2.5" />
            </button>
        </div>
    );
}

function DragPreview({ job }: { job: PipelineJob }) {
    const productName = job.transactionItem?.productVariant?.product?.name
        || job.transactionItem?.productVariant?.variantName
        || "—";
    const customerName = job.transaction?.customerName || "—";
    return (
        // will-change + translateZ: hint ke browser supaya layer ini di-composite di GPU
        // → transform animasi tidak blokir main thread → gerakan smooth
        <div
            className="bg-card rounded-lg shadow-2xl border-2 border-indigo-400 p-2 text-xs w-56 rotate-2 cursor-grabbing"
            style={{ willChange: "transform", transform: "translateZ(0)" }}
        >
            <div className="font-mono font-bold text-[10px] text-muted-foreground mb-1">{job.jobNumber}</div>
            <div className="font-semibold text-foreground line-clamp-2 leading-tight mb-1">{productName}</div>
            <div className="text-muted-foreground text-[11px] truncate">{customerName}</div>
        </div>
    );
}

// ─── Proof Viewer Modal ────────────────────────────────────────────────────

function ProofViewer({
    job, onClose, onUpload, onDelete, uploading, deleting,
}: {
    job: PipelineJob;
    onClose: () => void;
    onUpload: (jobId: number, files: FileList) => void;
    onDelete: (proofId: number) => void;
    uploading: boolean;
    deleting: boolean;
}) {
    const proofs = getProofList(job);
    const [idx, setIdx] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (proofs.length === 0) {
        onClose();
        return null;
    }
    const safeIdx = Math.min(idx, proofs.length - 1);
    const current = proofs[safeIdx];
    const currentUrl = resolvePhotoUrl(current.filename);

    const prev = () => setIdx(i => (i === 0 ? proofs.length - 1 : i - 1));
    const next = () => setIdx(i => (i === proofs.length - 1 ? 0 : i + 1));

    return (
        <div className="fixed inset-0 bg-black/80 z-[300] flex flex-col" onClick={onClose}>
            <div className="flex items-center justify-between p-3 sm:p-4 text-white" onClick={(e) => e.stopPropagation()}>
                <div className="text-xs sm:text-sm">
                    <div className="font-bold font-mono">{job.jobNumber}</div>
                    <div className="text-white/70 text-[10px] sm:text-xs">
                        Proof {safeIdx + 1} / {proofs.length}
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded">
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="flex-1 flex items-center justify-center relative px-2 sm:px-12" onClick={(e) => e.stopPropagation()}>
                {currentUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUrl} alt={`Proof ${safeIdx + 1}`} className="max-w-full max-h-[70vh] object-contain" />
                )}
                {proofs.length > 1 && (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center" aria-label="Previous">
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center" aria-label="Next">
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </>
                )}
            </div>

            <div className="bg-black/90 p-3 sm:p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                {proofs.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {proofs.map((p, i) => {
                            const u = resolvePhotoUrl(p.filename);
                            return (
                                <button key={p.id ?? i} onClick={() => setIdx(i)} className={`flex-shrink-0 w-14 h-14 rounded overflow-hidden border-2 ${i === safeIdx ? "border-emerald-400" : "border-white/30 opacity-60 hover:opacity-100"}`}>
                                    {u && <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />}
                                </button>
                            );
                        })}
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => { const f = e.target.files; if (f && f.length > 0) onUpload(job.id, f); e.target.value = ""; }}
                    />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        Tambah Proof
                    </button>
                    {current.id != null && (
                        <button type="button" disabled={deleting}
                            onClick={() => { if (confirm("Hapus foto proof ini?")) onDelete(current.id!); }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                        >
                            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Hapus Foto Ini
                        </button>
                    )}
                    {currentUrl && (
                        <a href={currentUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-semibold"
                        >
                            Buka Original
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Jahit Modal ───────────────────────────────────────────────────────────

function JahitModal({
    job, onClose, onSubmit, submitting,
}: {
    job: PipelineJob;
    onClose: () => void;
    onSubmit: (data: { penjahitName: string; jahitInDate: string; jahitEstimate: string }) => void;
    submitting: boolean;
}) {
    const today = dayjs().format("YYYY-MM-DD");
    const defaultEst = dayjs().add(3, "day").format("YYYY-MM-DD");
    const [penjahitName, setPenjahitName] = useState(job.penjahitName || "");
    const [jahitInDate, setJahitInDate] = useState(
        job.jahitInDate ? dayjs(job.jahitInDate).format("YYYY-MM-DD") : today,
    );
    const [jahitEstimate, setJahitEstimate] = useState(
        job.jahitEstimate ? dayjs(job.jahitEstimate).format("YYYY-MM-DD") : defaultEst,
    );

    const canSubmit = penjahitName.trim().length > 0 && jahitInDate && jahitEstimate;

    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-card rounded-xl p-4 sm:p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base sm:text-lg">Kirim ke Jahit</h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                    Job <span className="font-mono font-semibold">{job.jobNumber}</span> akan masuk antrian jahit.
                    Lewat estimasi → card berubah warna merah.
                </p>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Nama Penjahit *</label>
                        <input
                            value={penjahitName}
                            onChange={(e) => setPenjahitName(e.target.value)}
                            placeholder="mis. Bu Yuni / Penjahit Sumber Rejeki"
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Tanggal Masuk</label>
                            <input
                                type="date"
                                value={jahitInDate}
                                onChange={(e) => setJahitInDate(e.target.value)}
                                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Estimasi Jadi</label>
                            <input
                                type="date"
                                value={jahitEstimate}
                                onChange={(e) => setJahitEstimate(e.target.value)}
                                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm">Batal</button>
                    <button
                        onClick={() => onSubmit({ penjahitName: penjahitName.trim(), jahitInDate, jahitEstimate })}
                        disabled={submitting || !canSubmit}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                        {submitting ? "Menyimpan..." : "Kirim ke Jahit"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Retur Modal ───────────────────────────────────────────────────────────

function ReturModal({
    job, onClose, onSubmit, submitting,
}: {
    job: PipelineJob;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    submitting: boolean;
}) {
    const [reason, setReason] = useState(job.returnReason || "");
    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-card rounded-xl p-4 sm:p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base sm:text-lg text-red-700">Tandai Retur</h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    Job <span className="font-mono font-semibold">{job.jobNumber}</span> akan ditandai sebagai retur.
                </p>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Alasan Retur</label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="mis. Salah ukuran, warna tidak sesuai, dll"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                    autoFocus
                />
                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm">Batal</button>
                    <button
                        onClick={() => onSubmit(reason.trim())}
                        disabled={submitting}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                        {submitting ? "Menyimpan..." : "Tandai Retur"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Cancel Modal (klien tidak jadi order) ──────────────────────────────────

function CancelModal({
    job, onClose, onSubmit, submitting,
}: {
    job: PipelineJob;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    submitting: boolean;
}) {
    const [reason, setReason] = useState("");
    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-card rounded-xl p-4 sm:p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base sm:text-lg text-amber-700 flex items-center gap-1.5">
                        <Ban className="h-5 w-5" /> Tandai Batal
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    Job <span className="font-mono font-semibold">{job.jobNumber}</span> ditandai batal (klien tidak jadi order).
                    Kartu hilang dari kanban, tapi tetap tercatat di leaderboard designer.
                </p>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Alasan Batal <span className="font-normal text-muted-foreground">(opsional)</span></label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="mis. Klien mundur, pindah ke kompetitor, harga tidak deal, dll"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                    autoFocus
                />
                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm">Kembali</button>
                    <button
                        onClick={() => onSubmit(reason.trim())}
                        disabled={submitting}
                        className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                        {submitting ? "Menyimpan..." : "Tandai Batal"}
                    </button>
                </div>
            </div>
        </div>
    );
}
