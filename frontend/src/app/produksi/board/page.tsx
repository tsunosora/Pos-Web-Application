"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    DndContext, DragEndEvent, DragStartEvent, DragOverlay,
    PointerSensor, TouchSensor, useSensor, useSensors, pointerWithin,
    useDroppable, useDraggable,
} from "@dnd-kit/core";
import {
    getPublicPipelineJobs, updatePublicPipelineStage,
    uploadPublicProofImage, deletePublicProof, resolvePhotoUrl,
    verifyOperatorPin, getPublicBranches, type PublicBranch,
    type PipelineJob, type PipelineStage, type OperatorSession,
    PIPELINE_STAGES, PIPELINE_STAGE_LABEL,
} from "@/lib/api/production";
import { getPublicDesigners } from "@/lib/api/designers";
import { AssignDesignerModal } from "@/components/produksi/AssignDesignerModal";
import Link from "next/link";
import {
    Clock, User, GripVertical, AlertTriangle, Loader2, X,
    Upload, FileText, Image as ImageIcon, Trash2, ChevronLeft, ChevronRight,
    LogOut, ShieldCheck,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

const SESSION_KEY = "produksi_board_session_v1";

interface BoardSession {
    branchId: number;
    branchName: string;
    branchCode: string | null;
    pin: string;
    operatorName: string;
}

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

function getProofList(job: PipelineJob): { id?: number; filename: string }[] {
    if (job.proofs && job.proofs.length > 0) {
        return job.proofs.map(p => ({ id: p.id, filename: p.filename }));
    }
    if (job.proofImageUrl) return [{ filename: job.proofImageUrl }];
    return [];
}

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
    aman:   "border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 text-gray-500 hover:text-emerald-600",
    normal: "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100",
    urgent: "border-red-400 bg-red-50 text-red-700 hover:bg-red-100 animate-pulse",
};

export default function ProduksiBoardPage() {
    const [session, setSession] = useState<BoardSession | null>(null);
    const [hydrated, setHydrated] = useState(false);

    // Hydrate session dari localStorage (operator pulang-pergi tidak perlu login ulang)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (raw) {
                const s = JSON.parse(raw) as BoardSession;
                if (s.branchId && s.pin && s.operatorName) setSession(s);
            }
        } catch { /* ignore */ }
        setHydrated(true);
    }, []);

    const handleLogin = (s: BoardSession) => {
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        setSession(s);
    };

    const handleLogout = () => {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
    };

    if (!hydrated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!session) {
        return <LoginGate onLogin={handleLogin} />;
    }

    return <BoardKanban session={session} onLogout={handleLogout} />;
}

// ─── Login Gate (branch → PIN → operator name) ─────────────────────────────

function LoginGate({ onLogin }: { onLogin: (s: BoardSession) => void }) {
    const [branches, setBranches] = useState<PublicBranch[]>([]);
    const [branchId, setBranchId] = useState<number | null>(null);
    const [pin, setPin] = useState("");
    const [operatorName, setOperatorName] = useState("");
    const [step, setStep] = useState<'PIN' | 'NAME'>('PIN');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [designers, setDesigners] = useState<{ id: number; name: string }[]>([]);

    useEffect(() => {
        getPublicBranches().then(bs => {
            setBranches(bs);
            if (bs.length === 1) setBranchId(bs[0].id);
        }).catch(e => setError(e.message));
        getPublicDesigners().then(setDesigners).catch(() => {});
    }, []);

    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (branches.length > 1 && branchId == null) {
            setError("Pilih cabang dulu");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const bid = branchId ?? (branches.length === 1 ? branches[0].id : null);
            const res = await verifyOperatorPin(pin, bid ?? undefined);
            if (res.valid) {
                setStep('NAME');
            } else {
                setError(res.message || "PIN salah");
                setPin("");
            }
        } catch (e: any) {
            setError(e.message || "Gagal verifikasi PIN");
        } finally {
            setLoading(false);
        }
    };

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!operatorName.trim()) {
            setError("Nama wajib diisi");
            return;
        }
        const bid = branchId ?? (branches.length === 1 ? branches[0].id : null);
        const branch = branches.find(b => b.id === bid);
        if (!bid || !branch) {
            setError("Cabang tidak valid");
            return;
        }
        onLogin({
            branchId: bid,
            branchName: branch.name,
            branchCode: branch.code,
            pin,
            operatorName: operatorName.trim(),
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-blue-50 to-white p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 mb-3">
                        <ShieldCheck className="h-7 w-7 text-indigo-600" />
                    </div>
                    <h1 className="font-bold text-lg text-gray-800">Pipeline Produksi</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Akses operator &amp; desainer
                    </p>
                </div>

                {step === 'PIN' && (
                    <form onSubmit={handlePinSubmit} className="space-y-3">
                        {branches.length > 1 && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Cabang</label>
                                <select
                                    value={branchId ?? ""}
                                    onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="">— Pilih cabang —</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}{b.code ? ` (${b.code})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">PIN Operator</label>
                            <input
                                type="password"
                                inputMode="numeric"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                placeholder="••••"
                                autoFocus
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-mono tracking-widest text-center"
                            />
                        </div>
                        {error && <p className="text-xs text-red-600 text-center">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading || !pin}
                            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Verifikasi PIN
                        </button>
                    </form>
                )}

                {step === 'NAME' && (
                    <form onSubmit={handleNameSubmit} className="space-y-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-700 text-center">
                            ✓ PIN valid — masukkan nama Anda untuk mulai
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Operator / Desainer</label>
                            <select
                                value={operatorName}
                                onChange={(e) => setOperatorName(e.target.value)}
                                autoFocus
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                            >
                                <option value="">— Pilih nama —</option>
                                {designers.map(d => (
                                    <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-500 mt-1">
                                Disimpan di device ini — semua aksi (pindah card, upload proof) akan tercatat pakai nama ini.
                            </p>
                        </div>
                        {error && <p className="text-xs text-red-600">{error}</p>}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => { setStep('PIN'); setError(""); }}
                                className="flex-1 px-4 py-2.5 border rounded-lg text-sm"
                            >
                                Kembali
                            </button>
                            <button
                                type="submit"
                                disabled={!operatorName.trim()}
                                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                            >
                                Mulai
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── Kanban Board (operator mode) ──────────────────────────────────────────

function BoardKanban({ session, onLogout }: { session: BoardSession; onLogout: () => void }) {
    const qc = useQueryClient();
    const [isDragging, setIsDragging] = useState(false);
    const [activeJobId, setActiveJobId] = useState<number | null>(null);
    const [jahitModal, setJahitModal] = useState<{ job: PipelineJob } | null>(null);
    const [returModal, setReturModal] = useState<{ job: PipelineJob } | null>(null);
    const [proofViewer, setProofViewer] = useState<{ job: PipelineJob } | null>(null);
    const [assignProof, setAssignProof] = useState<{ jobId: number; files: File[] } | null>(null);

    const opSession: OperatorSession = useMemo(() => ({
        branchId: session.branchId,
        pin: session.pin,
        operatorName: session.operatorName,
    }), [session]);

    const { data: jobs = [], isLoading, error } = useQuery({
        queryKey: ["produksi-board", session.branchId, session.pin],
        queryFn: () => getPublicPipelineJobs(opSession),
        refetchInterval: isDragging ? false : 60_000,
        refetchOnWindowFocus: false,
    });

    // Daftar desainer untuk dropdown atribusi saat upload proof
    const { data: designers = [] } = useQuery({
        queryKey: ["public-designers"],
        queryFn: getPublicDesigners,
        staleTime: 5 * 60_000,
    });

    const stageMut = useMutation({
        mutationFn: (data: { id: number; payload: Parameters<typeof updatePublicPipelineStage>[2] }) =>
            updatePublicPipelineStage(data.id, opSession, data.payload),
        onMutate: async (data) => {
            await qc.cancelQueries({ queryKey: ["produksi-board"] });
            const prev = qc.getQueryData<PipelineJob[]>(["produksi-board", session.branchId, session.pin]);
            qc.setQueryData<PipelineJob[]>(
                ["produksi-board", session.branchId, session.pin],
                (old) => old?.map(j => j.id === data.id ? { ...j, ...data.payload, lastUpdatedBy: session.operatorName } as PipelineJob : j),
            );
            return { prev };
        },
        onError: (_e, _d, ctx) => {
            if (ctx?.prev) qc.setQueryData(["produksi-board", session.branchId, session.pin], ctx.prev);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: ["produksi-board"] }),
    });

    const uploadMut = useMutation({
        mutationFn: (data: { id: number; file: File; designerName?: string }) =>
            uploadPublicProofImage(data.id, opSession, data.file, data.designerName),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["produksi-board"] }),
    });

    const deleteProofMut = useMutation({
        mutationFn: (proofId: number) => deletePublicProof(proofId, opSession),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["produksi-board"] }),
    });

    // Pilih file dulu → buka modal "assign desainer", baru upload setelah dipilih
    const handleRequestProof = useCallback((jobId: number, files: FileList) => {
        setAssignProof({ jobId, files: Array.from(files) });
    }, []);

    const doUploadProof = useCallback((designerName?: string) => {
        setAssignProof(prev => {
            if (prev) prev.files.forEach(file => uploadMut.mutate({ id: prev.jobId, file, designerName }));
            return null;
        });
    }, [uploadMut]);

    const handleDeleteProof = useCallback((proofId: number) => {
        deleteProofMut.mutate(proofId);
    }, [deleteProofMut]);

    const handleOpenProofViewer = useCallback((job: PipelineJob) => {
        setProofViewer({ job });
    }, []);

    const currentProofViewerJob = useMemo(() => {
        if (!proofViewer) return null;
        return jobs.find(j => j.id === proofViewer.job.id) || proofViewer.job;
    }, [proofViewer, jobs]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const grouped = useMemo(() => {
        const g: Record<PipelineStage, PipelineJob[]> = {
            DESIGN: [], PRINT: [], ANTRIAN_PRESS: [], JAHIT: [],
            QC_PACKING: [], KIRIM: [], RETUR: [], SELESAI: [],
        };
        for (const j of jobs) {
            const s = (j.pipelineStage || "DESIGN") as PipelineStage;
            (g[s] || g.DESIGN).push(j);
        }
        return g;
    }, [jobs]);

    const handleDragStart = useCallback((e: DragStartEvent) => {
        setIsDragging(true);
        setActiveJobId(Number(e.active.id));
    }, []);

    const handleDragEnd = useCallback((e: DragEndEvent) => {
        setIsDragging(false);
        setActiveJobId(null);
        if (!e.over) return;
        const jobId = Number(e.active.id);
        const newStage = e.over.id as PipelineStage;
        const job = jobs.find(j => j.id === jobId);
        if (!job || (job.pipelineStage || "DESIGN") === newStage) return;
        if (newStage === "JAHIT") { setJahitModal({ job }); return; }
        if (newStage === "RETUR") { setReturModal({ job }); return; }
        stageMut.mutate({ id: jobId, payload: { pipelineStage: newStage } });
    }, [jobs, stageMut]);

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Top bar */}
            <div className="bg-white border-b shadow-sm px-3 py-2 flex items-center justify-between gap-2 flex-wrap sticky top-0 z-30">
                <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                    <div className="min-w-0">
                        <div className="font-bold text-sm truncate">Pipeline Produksi</div>
                        <div className="text-[10px] text-gray-500 truncate">
                            {session.branchName} · <span className="font-semibold text-indigo-700">{session.operatorName}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                        <LogOut className="h-3.5 w-3.5" /> Keluar
                    </button>
                </div>
            </div>

            {error ? (
                <div className="p-4 text-center text-sm text-red-600">
                    {(error as Error).message}
                    <button onClick={onLogout} className="block mx-auto mt-2 text-xs underline">Login ulang</button>
                </div>
            ) : (
                <div className="flex-1 p-2 sm:p-3">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={pointerWithin}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={() => { setIsDragging(false); setActiveJobId(null); }}
                    >
                        <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none">
                            {PIPELINE_STAGES.map((stage) => (
                                <Column
                                    key={stage}
                                    stage={stage}
                                    jobs={grouped[stage]}
                                    onRequestProof={handleRequestProof}
                                    onOpenProofViewer={handleOpenProofViewer}
                                    uploading={uploadMut.isPending}
                                />
                            ))}
                        </div>
                        <DragOverlay dropAnimation={null}>
                            {activeJobId != null && (() => {
                                const j = jobs.find(x => x.id === activeJobId);
                                return j ? <DragPreview job={j} /> : null;
                            })()}
                        </DragOverlay>
                    </DndContext>
                </div>
            )}

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

            {assignProof && (
                <AssignDesignerModal
                    designers={designers}
                    fileCount={assignProof.files.length}
                    defaultName={jobs.find(j => j.id === assignProof.jobId)?.designerName || ""}
                    onPick={(name) => doUploadProof(name || undefined)}
                    onCancel={() => setAssignProof(null)}
                />
            )}

            {currentProofViewerJob && proofViewer && (
                <ProofViewer
                    job={currentProofViewerJob}
                    onClose={() => setProofViewer(null)}
                    onUpload={handleRequestProof}
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
    stage, jobs, onRequestProof, onOpenProofViewer, uploading,
}: {
    stage: PipelineStage;
    jobs: PipelineJob[];
    onRequestProof: (jobId: number, files: FileList) => void;
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
            <div className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 flex-1 overflow-y-auto max-h-[64vh] sm:max-h-[72vh]">
                {jobs.length === 0 ? (
                    <p className="text-[10px] sm:text-xs text-gray-400 text-center py-6 italic">— kosong —</p>
                ) : (
                    jobs.map((job) => (
                        <KanbanCard
                            key={job.id}
                            job={job}
                            onRequestProof={onRequestProof}
                            onOpenProofViewer={onOpenProofViewer}
                            uploading={uploading}
                        />
                    ))
                )}
            </div>
        </div>
    );
});

// ─── Card ──────────────────────────────────────────────────────────────────

interface CardProps {
    job: PipelineJob;
    onRequestProof: (jobId: number, files: FileList) => void;
    onOpenProofViewer: (job: PipelineJob) => void;
    uploading: boolean;
}

const KanbanCard = memo(function KanbanCard({
    job, onRequestProof, onOpenProofViewer, uploading,
}: CardProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: String(job.id),
    });
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

    const needsProof = isDesign && proofs.length === 0;
    const designUrgency = needsProof ? getDesignUrgency(job.createdAt) : null;

    const firstProof = proofs[0] ? resolvePhotoUrl(proofs[0].filename) : null;

    return (
        <div
            ref={setNodeRef}
            className={`bg-white rounded-lg shadow-sm border p-1.5 sm:p-2 text-[11px] sm:text-xs ${isDragging ? "opacity-30" : ""} ${jahitLate ? "border-red-400 bg-red-50" : "border-gray-200"}`}
        >
            <div className="flex items-start justify-between gap-1 mb-1">
                <span className="font-mono font-bold text-[9px] sm:text-[10px] text-gray-600 truncate">{job.jobNumber}</span>
                <button
                    {...attributes}
                    {...listeners}
                    className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 p-0.5"
                    aria-label="Drag"
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </button>
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
                    className="mt-1.5 relative w-full block group/proof"
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
                        {proofs.length > 1 ? `${proofs.length}x` : 'ACC'}
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
                            if (f && f.length > 0) onRequestProof(job.id, f);
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

            {/* Last updated by — kelihatan kecil di bawah */}
            {job.lastUpdatedBy && (
                <div className="mt-1.5 pt-1 border-t border-gray-100 text-[9px] text-gray-400 italic truncate">
                    by {job.lastUpdatedBy}
                    {job.lastUpdatedAt && ` · ${dayjs(job.lastUpdatedAt).format("DD MMM HH:mm")}`}
                </div>
            )}
        </div>
    );
});

// ─── Drag Preview ──────────────────────────────────────────────────────────

function DragPreview({ job }: { job: PipelineJob }) {
    const productName = job.transactionItem?.productVariant?.product?.name
        || job.transactionItem?.productVariant?.variantName
        || "—";
    const customerName = job.transaction?.customerName || "—";
    return (
        <div className="bg-white rounded-lg shadow-2xl border-2 border-indigo-400 p-2 text-xs w-56 rotate-2 cursor-grabbing">
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
                    <div className="text-white/70 text-[10px] sm:text-xs">Proof {safeIdx + 1} / {proofs.length}</div>
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
                        <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center"><ChevronRight className="h-5 w-5" /></button>
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
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold disabled:opacity-50">
                                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Tambah Proof
                            </button>
                            {current.id != null && (
                                <button type="button" onClick={() => { if (confirm("Hapus proof ini?")) onDelete(current.id!); }} disabled={deleting} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold disabled:opacity-50">
                                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Hapus
                                </button>
                            )}
                        </>
                    )}
                    {currentUrl && (
                        <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-semibold">
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
    const [jahitInDate, setJahitInDate] = useState(job.jahitInDate ? dayjs(job.jahitInDate).format("YYYY-MM-DD") : today);
    const [jahitEstimate, setJahitEstimate] = useState(job.jahitEstimate ? dayjs(job.jahitEstimate).format("YYYY-MM-DD") : defaultEst);
    const canSubmit = penjahitName.trim().length > 0 && jahitInDate && jahitEstimate;
    return (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl p-4 sm:p-5 max-w-md w-full">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base sm:text-lg">Kirim ke Jahit</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                    Job <span className="font-mono font-semibold">{job.jobNumber}</span> akan masuk antrian jahit. Lewat estimasi → card berubah warna merah.
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Penjahit *</label>
                        <input value={penjahitName} onChange={(e) => setPenjahitName(e.target.value)} placeholder="mis. Bu Yuni" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" autoFocus />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal Masuk</label>
                            <input type="date" value={jahitInDate} onChange={(e) => setJahitInDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Estimasi Jadi</label>
                            <input type="date" value={jahitEstimate} onChange={(e) => setJahitEstimate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm">Batal</button>
                    <button onClick={() => onSubmit({ penjahitName: penjahitName.trim(), jahitInDate, jahitEstimate })} disabled={submitting || !canSubmit} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
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
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-xs text-gray-500 mb-3">Job <span className="font-mono font-semibold">{job.jobNumber}</span> akan ditandai sebagai retur.</p>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alasan Retur</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="mis. Salah ukuran" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" autoFocus />
                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm">Batal</button>
                    <button onClick={() => onSubmit(reason.trim())} disabled={submitting} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                        {submitting ? "Menyimpan..." : "Tandai Retur"}
                    </button>
                </div>
            </div>
        </div>
    );
}
