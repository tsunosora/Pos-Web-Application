"use client";

import { Tab, formatDeadline, getDimLabel, getSambungInfo } from './produksi-utils';

interface JobCardProps {
    job: any;
    tab: Tab;
    gangMode: boolean;
    selected: boolean;
    onSelect: () => void;
    onProcess: () => void;
    onComplete: (id: number) => void;
    onPickup: (id: number) => void;
    onStartAssembly: (job: any) => void;
    onCompleteAssembly: (id: number) => void;
    onDetail: (job: any) => void;
    maxRollEffectiveWidth: number;
}

export function JobCard({ job, tab, gangMode, selected, onSelect, onProcess, onComplete, onPickup, onStartAssembly, onCompleteAssembly, onDetail, maxRollEffectiveWidth }: JobCardProps) {
    const dl = formatDeadline(job.deadline ?? job.transaction?.productionDeadline);
    const isExpress = job.priority === 'EXPRESS';
    const productName = job.transactionItem?.productVariant?.product?.name ?? '—';
    const variantName = job.transactionItem?.productVariant?.variantName;
    const note = job.transactionItem?.note;
    const prodNotes = job.notes;
    const rollLabel = job.rollVariant
        ? `${job.rollVariant.product?.name} — ${job.rollLengthUsed}m`
        : job.usedWaste ? 'Sisa/Waste' : '—';
    const w = job.transactionItem?.widthCm ? Number(job.transactionItem.widthCm) : null;
    const h = job.transactionItem?.heightCm ? Number(job.transactionItem.heightCm) : null;
    const sambung = getSambungInfo(w, h, maxRollEffectiveWidth);
    const isUnit = job.transactionItem?.productVariant?.product?.pricingMode === 'UNIT';
    // Titip cetak: job dikerjakan di cabang ini, tapi transaksinya dari cabang lain.
    const isInterBranch = job.transaction?.branch && job.branchId
        && job.transaction.branch.id !== job.branchId;
    const sourceBranchLabel = isInterBranch
        ? (job.transaction.branch.code
            ? `${job.transaction.branch.code}`
            : job.transaction.branch.name)
        : null;
    // Label nota pemilik — cabang asal transaksi (yang jualan & dapat revenue)
    const ownerBranchName: string | null = job.transaction?.branch?.name || null;
    const ownerBranchCode: string | null = job.transaction?.branch?.code || null;
    const ownerLabel = ownerBranchCode || ownerBranchName;

    return (
        <div
            onClick={gangMode && tab === 'ANTRIAN' ? onSelect : undefined}
            className={`bg-card border rounded-2xl overflow-hidden transition-all ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-border'} ${gangMode && tab === 'ANTRIAN' ? 'cursor-pointer active:scale-[0.99]' : ''}`}>

            <div className={`h-1 ${isExpress ? 'bg-red-500' : 'bg-muted'}`} />

            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        {gangMode && tab === 'ANTRIAN' && (
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'border-primary bg-primary' : 'border-border'}`}>
                                {selected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                        )}
                        {isExpress && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full">EXPRESS</span>
                        )}
                        {isInterBranch ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/30 rounded-full" title={`Titipan cetak dari cabang ${job.transaction.branch.name}`}>
                                ⚑ Titipan {sourceBranchLabel}
                            </span>
                        ) : ownerLabel ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-500/15 text-sky-700 border border-sky-500/30 rounded-full" title={`Nota milik ${ownerBranchName}`}>
                                🏢 {ownerLabel}
                            </span>
                        ) : null}
                        {sambung.needsSambung && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-500/15 text-orange-600 border border-orange-500/30 rounded-full">SAMBUNG ×{sambung.strips}</span>
                        )}
                        <span className="text-xs font-mono text-muted-foreground">{job.jobNumber}</span>
                        {job.batch && (
                            <span className="text-[10px] font-medium px-2 py-0.5 bg-blue-500/15 text-blue-600 rounded-full">{job.batch.batchNumber}</span>
                        )}
                    </div>
                    <span className={`text-xs font-medium shrink-0 ${dl.urgent ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                        {dl.label}
                    </span>
                </div>

                <p className="font-semibold text-sm text-foreground">{job.transaction?.customerName || 'Tanpa nama'}</p>
                <p className="text-xs text-muted-foreground">{job.transaction?.invoiceNumber}</p>

                <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 bg-muted rounded-lg font-medium">{productName}</span>
                    {variantName && (
                        <span className="text-xs px-2 py-1 bg-muted/60 rounded-lg text-muted-foreground">{variantName}</span>
                    )}
                    {isUnit ? (
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg font-semibold">
                            {job.transactionItem?.quantity ?? 1} pcs
                        </span>
                    ) : getDimLabel(job) ? (
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg font-mono font-medium">{getDimLabel(job)}</span>
                    ) : null}
                </div>

                {(note || prodNotes) && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 space-y-0.5">
                        {note && <p><span className="font-medium">Desain:</span> {note}</p>}
                        {prodNotes && <p><span className="font-medium">Produksi:</span> {prodNotes}</p>}
                    </div>
                )}

                {(tab === 'PROSES' || tab === 'SELESAI' || tab === 'DIAMBIL') && job.rollVariant && (
                    <div className="mt-2 text-xs text-muted-foreground">
                        Bahan: <span className="font-medium text-foreground">{rollLabel}</span>
                    </div>
                )}

                {!gangMode && (
                    <div className="mt-3 flex gap-2 justify-end">
                        <button onClick={e => { e.stopPropagation(); onDetail(job); }}
                            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Lihat detail invoice">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </button>
                        {tab === 'ANTRIAN' && (
                            <button onClick={e => { e.stopPropagation(); onProcess(); }}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold active:scale-95 transition-transform">
                                {isUnit ? 'Kerjakan' : 'Proses'}
                            </button>
                        )}
                        {tab === 'PROSES' && !job.batchId && (
                            <button onClick={() => onComplete(job.id)}
                                className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform">
                                Selesai
                            </button>
                        )}
                        {tab === 'MENUNGGU_PASANG' && (
                            <button onClick={() => onStartAssembly(job)}
                                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform">
                                Mulai Pasang
                            </button>
                        )}
                        {tab === 'PASANG' && (
                            <button onClick={() => onCompleteAssembly(job.id)}
                                className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform">
                                Selesai Pasang
                            </button>
                        )}
                        {tab === 'SELESAI' && (
                            <button onClick={() => onPickup(job.id)}
                                className="px-4 py-2 bg-muted text-foreground border border-border rounded-xl text-sm font-medium active:scale-95 transition-transform">
                                Sudah Diambil
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
