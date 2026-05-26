"use client";

import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    DndContext, DragEndEvent, DragStartEvent, DragOverlay,
    PointerSensor, TouchSensor, useSensor, useSensors,
    rectIntersection, MeasuringStrategy,
    useDroppable, useDraggable,
} from "@dnd-kit/core";
import {
    getPipelineJobs, updatePipelineStage, uploadPipelineProofImage,
    deletePipelineProof, resolvePhotoUrl,
    type PipelineJob, type PipelineStage,
    PIPELINE_STAGES, PIPELINE_STAGE_LABEL,
} from "@/lib/api/production";
import Link from "next/link";
import {
    Clock, User, GripVertical, AlertTriangle, Loader2, X,
    Upload, FileText, Image as ImageIcon, Trash2, ChevronLeft, ChevronRight, Search, Calendar,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

const COLUMN_STYLE: Record<PipelineStage, { color: string; bg: string }> = {
    DESIGN:        { color: "text-slate-700",   bg: "bg-slate-50 border-slate-200" },
    PRINT:         { color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
    ANTRIAN_PRESS: { color: "text-cyan-700",    bg: "bg-cyan-50 border-cyan-200" },
    JAHIT:         { color: "text-purple-700",  bg: "bg-purple-50 border-purple-200" },
    QC_PACKING:    { color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
    KIRIM:         { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    RETUR:         { color: "text-red-700",     bg: "bg-red-50 border-red-200" },
    SELESAI:       { color: "text-gray-700",    bg: "bg-gray-50 border-gray-200" },
};

const PRIORITY_BADGE: Record<string, string> = {
    URGENT: "bg-red-100 text-red-700 border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    NORMAL: "bg-gray-100 text-gray-600 border-gray-200",
    LOW: "bg-sky-100 text-sky-700 border-sky-200",
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
    const [proofViewer, setProofViewer] = useState<{ job: PipelineJob } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterPriority, setFilterPriority] = useState<string>("ALL");
    const [filterDate, setFilterDate] = useState<"ALL" | "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "OVERDUE">("ALL");

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
        mutationFn: (data: { id: number; file: File }) => uploadPipelineProofImage(data.id, data.file),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["produksi-pipeline"] }),
    });

    const deleteProofMut = useMutation({
        mutationFn: (proofId: number) => deletePipelineProof(proofId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["produksi-pipeline"] }),
    });

    const handleUploadProof = useCallback((jobId: number, files: FileList) => {
        Array.from(files).forEach((file) => uploadMut.mutate({ id: jobId, file }));
    }, [uploadMut]);

    const handleDeleteProof = useCallback((proofId: number) => {
        deleteProofMut.mutate(proofId);
    }, [deleteProofMut]);

    const handleOpenProofViewer = useCallback((job: PipelineJob) => {
        setProofViewer({ job });
    }, []);

    // Refresh proofViewer.job kalau data updated (mis. delete proof)
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
            DESIGN: [], PRINT: [], ANTRIAN_PRESS: [], JAHIT: [],
            QC_PACKING: [], KIRIM: [], RETUR: [], SELESAI: [],
        };
        for (const j of jobs) {
            // Filter prioritas
            if (filterPriority !== "ALL" && (j.priority || "NORMAL") !== filterPriority) continue;

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
    }, [jobs, deferredSearch, filterPriority, filterDate]);

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

    const totalFiltered = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
    const totalAll = jobs.length;
    const isFiltering = deferredSearch.trim() !== "" || filterPriority !== "ALL" || filterDate !== "ALL";

    return (
        <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-lg sm:text-xl font-bold text-gray-800">Pipeline Produksi</h1>
                    <p className="text-[10px] sm:text-xs text-gray-500">
                        Drag &amp; drop card antar kolom. Tap-hold di mobile.
                        {isFiltering && (
                            <span className="ml-1.5 text-indigo-600 font-semibold">
                                · Menampilkan {totalFiltered} dari {totalAll} job
                            </span>
                        )}
                    </p>
                </div>
                {isLoading && <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />}
            </div>

            {/* Filter bar */}
            <div className="space-y-2">
                {/* Baris 1: Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Cari pelanggan, no. invoice, no. job..."
                        className="w-full pl-8 pr-8 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Baris 2: Filter Tanggal + Prioritas + Reset */}
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Filter Tanggal */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
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
                                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="w-px h-4 bg-gray-200 self-center hidden sm:block" />

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
                                        : p === "NORMAL" ? "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                                {p === "ALL" ? "Semua" : p}
                            </button>
                        ))}
                    </div>

                    {isFiltering && (
                        <button
                            onClick={() => { setSearchQuery(""); setFilterPriority("ALL"); setFilterDate("ALL"); }}
                            className="text-[11px] text-gray-500 hover:text-gray-700 underline whitespace-nowrap ml-auto"
                        >
                            Reset filter
                        </button>
                    )}
                </div>
            </div>

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
        </div>
    );
}

// ─── Column ────────────────────────────────────────────────────────────────

const Column = memo(function Column({
    stage, jobs, activeJobId, onUploadProof, onOpenProofViewer, uploading,
}: {
    stage: PipelineStage;
    jobs: PipelineJob[];
    activeJobId: number | null;
    onUploadProof: (jobId: number, files: FileList) => void;
    onOpenProofViewer: (job: PipelineJob) => void;
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
                    <p className="text-[10px] sm:text-xs text-gray-400 text-center py-6 italic">— kosong —</p>
                ) : (
                    jobs.map((job) => (
                        <KanbanCard
                            key={job.id}
                            job={job}
                            isActive={activeJobId === job.id}
                            onUploadProof={onUploadProof}
                            onOpenProofViewer={onOpenProofViewer}
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
    job, isActive, onUploadProof, onOpenProofViewer, uploading,
}: {
    job: PipelineJob;
    isActive: boolean;
    onUploadProof: (jobId: number, files: FileList) => void;
    onOpenProofViewer: (job: PipelineJob) => void;
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
                uploading={uploading}
            />
        </div>
    );
});

// ─── Card: heavy content (memoized, zero dnd hooks) ───────────────────────
// Tidak ada useDraggable/useDroppable → tidak subscribe ke DnD context.
// Saat pointer move selama drag, props komponen ini tidak berubah (isActive
// hanya berubah saat drag start/end, bukan saat move) → React.memo bail out
// → zero re-render selama drag. Ini sumber percepatan utama.

const KanbanCardInner = memo(function KanbanCardInner({
    job, isActive, onUploadProof, onOpenProofViewer, uploading,
}: {
    job: PipelineJob;
    isActive: boolean;
    onUploadProof: (jobId: number, files: FileList) => void;
    onOpenProofViewer: (job: PipelineJob) => void;
    uploading: boolean;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    const jahitLate = job.pipelineStage === "JAHIT"
        && job.jahitEstimate
        && dayjs(job.jahitEstimate).isBefore(dayjs());

    const deadlineLate = job.deadline && dayjs(job.deadline).isBefore(dayjs())
        && job.pipelineStage !== "SELESAI" && job.pipelineStage !== "KIRIM";

    const firstProof = proofs[0] ? resolvePhotoUrl(proofs[0].filename) : null;

    return (
        <div
            className={`bg-white rounded-lg shadow-sm border p-1.5 sm:p-2 text-[11px] sm:text-xs cursor-grab active:cursor-grabbing select-none ${isActive ? "opacity-30" : ""} ${jahitLate ? "border-red-400 bg-red-50" : "border-gray-200"}`}
        >
            <div className="flex items-start justify-between gap-1 mb-1">
                <span className="font-mono font-bold text-[9px] sm:text-[10px] text-gray-600 truncate">{job.jobNumber}</span>
                <GripVertical className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            </div>

            {job.priority && job.priority !== "NORMAL" && (
                <span className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-semibold mb-1 ${PRIORITY_BADGE[job.priority] || PRIORITY_BADGE.NORMAL}`}>
                    {job.priority}
                </span>
            )}

            <div className="font-semibold text-gray-800 line-clamp-2 leading-tight mb-1">
                {productName}
            </div>

            <div className="text-gray-600 space-y-0.5">
                <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{customerName}</span>
                </div>
                <div className="text-gray-500">
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
                    <div className="flex items-center gap-1 text-gray-500">
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
                <div className="mt-1.5">
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
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 text-gray-500 hover:text-emerald-600 rounded text-[10px] font-semibold disabled:opacity-50"
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
                <div className={`mt-1.5 pt-1.5 border-t text-[10px] ${jahitLate ? "border-red-200 text-red-700 font-semibold" : "border-gray-100 text-gray-600"}`}>
                    {job.penjahitName && <div className="truncate">👔 {job.penjahitName}</div>}
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
                <div className="mt-1.5 pt-1.5 border-t border-red-200 text-[10px] text-red-700 line-clamp-2">
                    📦 {job.returnReason}
                </div>
            )}
        </div>
    );
});

// ─── Drag Preview (lightweight, untuk DragOverlay) ────────────────────────
// Hanya render summary minimum supaya drag tetap smooth — image & link skip.

function DragPreview({ job }: { job: PipelineJob }) {
    const productName = job.transactionItem?.productVariant?.product?.name
        || job.transactionItem?.productVariant?.variantName
        || "—";
    const customerName = job.transaction?.customerName || "—";
    return (
        // will-change + translateZ: hint ke browser supaya layer ini di-composite di GPU
        // → transform animasi tidak blokir main thread → gerakan smooth
        <div
            className="bg-white rounded-lg shadow-2xl border-2 border-indigo-400 p-2 text-xs w-56 rotate-2 cursor-grabbing"
            style={{ willChange: "transform", transform: "translateZ(0)" }}
        >
            <div className="font-mono font-bold text-[10px] text-gray-600 mb-1">{job.jobNumber}</div>
            <div className="font-semibold text-gray-800 line-clamp-2 leading-tight mb-1">{productName}</div>
            <div className="text-gray-500 text-[11px] truncate">{customerName}</div>
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
    const isDesign = (job.pipelineStage || "DESIGN") === "DESIGN";

    if (proofs.length === 0) {
        // Job tidak punya proof — close otomatis
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
            {/* Header */}
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

            {/* Image */}
            <div className="flex-1 flex items-center justify-center relative px-2 sm:px-12" onClick={(e) => e.stopPropagation()}>
                {currentUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={currentUrl}
                        alt={`Proof ${safeIdx + 1}`}
                        className="max-w-full max-h-[70vh] object-contain"
                    />
                )}
                {proofs.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); prev(); }}
                            className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); next(); }}
                            className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center"
                            aria-label="Next"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </>
                )}
            </div>

            {/* Thumbnails + actions */}
            <div className="bg-black/90 p-3 sm:p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                {proofs.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {proofs.map((p, i) => {
                            const u = resolvePhotoUrl(p.filename);
                            return (
                                <button
                                    key={p.id ?? i}
                                    onClick={() => setIdx(i)}
                                    className={`flex-shrink-0 w-14 h-14 rounded overflow-hidden border-2 ${i === safeIdx ? "border-emerald-400" : "border-white/30 opacity-60 hover:opacity-100"}`}
                                >
                                    {u && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    {isDesign && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files;
                                    if (f && f.length > 0) onUpload(job.id, f);
                                    e.target.value = "";
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                            >
                                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                Tambah Proof
                            </button>
                            {current.id != null && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirm("Hapus proof ini?")) onDelete(current.id!);
                                    }}
                                    disabled={deleting}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                                >
                                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                    Hapus
                                </button>
                            )}
                        </>
                    )}
                    {currentUrl && (
                        <a
                            href={currentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
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
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl p-4 sm:p-5 max-w-md w-full">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base sm:text-lg">Kirim ke Jahit</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                    Job <span className="font-mono font-semibold">{job.jobNumber}</span> akan masuk antrian jahit.
                    Lewat estimasi → card berubah warna merah.
                </p>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Penjahit *</label>
                        <input
                            value={penjahitName}
                            onChange={(e) => setPenjahitName(e.target.value)}
                            placeholder="mis. Bu Yuni / Penjahit Sumber Rejeki"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal Masuk</label>
                            <input
                                type="date"
                                value={jahitInDate}
                                onChange={(e) => setJahitInDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Estimasi Jadi</label>
                            <input
                                type="date"
                                value={jahitEstimate}
                                onChange={(e) => setJahitEstimate(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl p-4 sm:p-5 max-w-md w-full">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base sm:text-lg text-red-700">Tandai Retur</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    Job <span className="font-mono font-semibold">{job.jobNumber}</span> akan ditandai sebagai retur.
                </p>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alasan Retur</label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="mis. Salah ukuran, warna tidak sesuai, dll"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
