"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Loader2, Building2, Wallet, Landmark, CheckCircle2, AlertTriangle, X, HandCoins, Eraser } from "lucide-react";
import { getFinanceConsolidation, closeBranchBalance, fundBranchBalance, type ConsolidationBranch } from "@/lib/api/finance-analytics";

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const parseNum = (s: string) => Number(String(s).replace(/[^\d]/g, "")) || 0;

export function ConsolidationPanel() {
    const qc = useQueryClient();
    const [ym, setYm] = useState(dayjs().format("YYYY-MM"));
    const [year, month] = ym.split("-").map(Number);
    const [confirmClose, setConfirmClose] = useState<ConsolidationBranch | null>(null);
    const [fundOf, setFundOf] = useState<ConsolidationBranch | null>(null);
    const [alloc, setAlloc] = useState<Record<number, string>>({});
    const [err, setErr] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["finance-consolidation", year, month],
        queryFn: () => getFinanceConsolidation(year, month),
    });

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["finance-consolidation"] });
        qc.invalidateQueries({ queryKey: ["finance-reconciliation"] });
        qc.invalidateQueries({ queryKey: ["finance-candles"] });
    };
    const closeMut = useMutation({
        mutationFn: (b: ConsolidationBranch) => closeBranchBalance(year, month, b.branchId),
        onSuccess: () => { setConfirmClose(null); invalidate(); },
        onError: (e: any) => setErr(e?.response?.data?.message || "Gagal menutup saldo."),
    });
    const fundMut = useMutation({
        mutationFn: (b: ConsolidationBranch) => fundBranchBalance(year, month, b.branchId, b.accounts.map((a) => ({ bankAccountId: a.id, amount: parseNum(alloc[a.id] ?? "") })).filter((x) => x.amount > 0)),
        onSuccess: () => { setFundOf(null); setAlloc({}); invalidate(); },
        onError: (e: any) => setErr(e?.response?.data?.message || "Gagal memberi modal."),
    });

    const openFund = (b: ConsolidationBranch) => {
        const init: Record<number, string> = {};
        b.accounts.forEach((a, i) => { init[a.id] = i === 0 ? String(Math.round(b.suggestedModal)) : "0"; });
        setAlloc(init);
        setErr(null);
        setFundOf(b);
    };
    const allocTotal = fundOf ? fundOf.accounts.reduce((s, a) => s + parseNum(alloc[a.id] ?? ""), 0) : 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground">Saldo akhir semua toko yang dikumpulkan ke pusat, lalu diberi modal awal per rekening.</span>
                <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} max={dayjs().format("YYYY-MM")}
                    className="ml-auto bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground" />
            </div>

            {isLoading ? (
                <div className="h-40 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
            ) : !data || data.branches.length === 0 ? (
                <div className="h-24 grid place-items-center text-muted-foreground text-sm">Belum ada cabang/rekening.</div>
            ) : (
                <>
                    <div className="grid sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-border bg-card p-3">
                            <div className="text-xs text-muted-foreground flex items-center gap-1"><Landmark size={13} /> Total Saldo Bank</div>
                            <div className="text-lg font-semibold mt-0.5">{fmtRp(data.grandTotal.bank)}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-3">
                            <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet size={13} /> Total Kas Tunai</div>
                            <div className="text-lg font-semibold mt-0.5">{fmtRp(data.grandTotal.cash)}</div>
                        </div>
                        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                            <div className="text-xs text-muted-foreground">Total Dikumpulkan ke Pusat</div>
                            <div className="text-lg font-bold mt-0.5">{fmtRp(data.grandTotal.total)}</div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {data.branches.map((b) => {
                            const st = b.closing?.status;
                            return (
                                <div key={b.branchId} className="rounded-xl border border-border overflow-hidden">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 flex-wrap">
                                        <Building2 size={15} className="text-muted-foreground" />
                                        <span className="font-medium text-sm">{b.branchName}</span>
                                        {b.code && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{b.code}</span>}
                                        {st === "CLOSED" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-medium">Sudah disetor</span>}
                                        {st === "FUNDED" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 font-medium inline-flex items-center gap-0.5"><CheckCircle2 size={11} /> Sudah dimodali</span>}
                                        <span className="ml-auto text-sm font-semibold">{fmtRp(b.total)}</span>
                                    </div>
                                    <div className="divide-y divide-border">
                                        {b.accounts.map((a) => (
                                            <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                                                <Landmark size={13} className="text-muted-foreground shrink-0" />
                                                <span className="flex-1 truncate">{a.bankName} <span className="text-xs text-muted-foreground">· {a.accountNumber}</span></span>
                                                <span className="tabular-nums">{fmtRp(a.balance)}</span>
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
                                            <Wallet size={13} className="text-muted-foreground shrink-0" />
                                            <span className="flex-1">Kas tunai {b.cashAsOf && <span className="text-xs text-muted-foreground">· per {dayjs(b.cashAsOf).format("D MMM")}</span>}</span>
                                            <span className="tabular-nums">{fmtRp(b.cash)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs bg-muted/30 flex-wrap">
                                        {st === "FUNDED" ? (
                                            <span className="text-muted-foreground">Modal diberikan: <b className="text-foreground">{fmtRp(b.closing!.modalTotal)}</b></span>
                                        ) : (
                                            <span className="text-muted-foreground">Saran modal bulan depan: <b className="text-foreground">{fmtRp(b.suggestedModal)}</b></span>
                                        )}
                                        {b.branchId !== 0 && (
                                            <div className="flex items-center gap-2">
                                                {!st && b.total > 0 && (
                                                    <button onClick={() => { setErr(null); setConfirmClose(b); }}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 text-red-600 hover:bg-red-500/10 px-2.5 py-1 font-medium">
                                                        <Eraser size={13} /> Kosongkan & Tutup
                                                    </button>
                                                )}
                                                {st === "CLOSED" && b.accounts.length > 0 && (
                                                    <button onClick={() => openFund(b)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-green-500/40 text-green-600 hover:bg-green-500/10 px-2.5 py-1 font-medium">
                                                        <HandCoins size={13} /> Beri Modal
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Modal konfirmasi pengosongan */}
            {confirmClose && (
                <Dialog onClose={() => setConfirmClose(null)}>
                    <h3 className="font-semibold flex items-center gap-2"><AlertTriangle size={18} className="text-red-600" /> Kosongkan saldo {confirmClose.branchName}?</h3>
                    <p className="text-sm text-muted-foreground mt-2">Saldo berikut akan <b>disetor ke pusat</b> dan dicatat sebagai pengeluaran (cashflow). Saldo rekening jadi 0. Tindakan ini tidak bisa dibatalkan otomatis.</p>
                    <div className="mt-3 rounded-lg border border-border divide-y divide-border text-sm">
                        {confirmClose.accounts.map((a) => (
                            <div key={a.id} className="flex justify-between px-3 py-1.5"><span>{a.bankName}</span><span className="tabular-nums">{fmtRp(a.balance)}</span></div>
                        ))}
                        <div className="flex justify-between px-3 py-1.5"><span>Kas tunai</span><span className="tabular-nums">{fmtRp(confirmClose.cash)}</span></div>
                        <div className="flex justify-between px-3 py-1.5 font-semibold bg-muted/40"><span>Total disetor</span><span className="tabular-nums">{fmtRp(confirmClose.total)}</span></div>
                    </div>
                    {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setConfirmClose(null)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted">Batal</button>
                        <button onClick={() => closeMut.mutate(confirmClose)} disabled={closeMut.isPending}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-1">
                            {closeMut.isPending && <Loader2 size={14} className="animate-spin" />} Ya, kosongkan
                        </button>
                    </div>
                </Dialog>
            )}

            {/* Modal beri modal */}
            {fundOf && (
                <Dialog onClose={() => setFundOf(null)}>
                    <h3 className="font-semibold flex items-center gap-2"><HandCoins size={18} className="text-green-600" /> Beri modal {fundOf.branchName}</h3>
                    <p className="text-sm text-muted-foreground mt-2">Tentukan modal awal per rekening (saran sudah diisi, silakan sesuaikan). Dicatat sebagai pemasukan & menambah saldo rekening.</p>
                    <div className="mt-3 space-y-2">
                        {fundOf.accounts.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 text-sm">
                                <span className="flex-1 truncate">{a.bankName} <span className="text-xs text-muted-foreground">· {a.accountNumber}</span></span>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground">Rp</span>
                                    <input inputMode="numeric" value={alloc[a.id] ?? ""} onChange={(e) => setAlloc((p) => ({ ...p, [a.id]: e.target.value }))}
                                        className="w-32 bg-background border border-border rounded-lg px-2 py-1 text-sm text-right tabular-nums" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-3 pt-2 border-t border-border text-sm font-semibold"><span>Total modal</span><span className="tabular-nums">{fmtRp(allocTotal)}</span></div>
                    {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setFundOf(null)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted">Batal</button>
                        <button onClick={() => fundMut.mutate(fundOf)} disabled={fundMut.isPending || allocTotal <= 0}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 inline-flex items-center gap-1">
                            {fundMut.isPending && <Loader2 size={14} className="animate-spin" />} Beri modal
                        </button>
                    </div>
                </Dialog>
            )}
        </div>
    );
}

function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
                {children}
            </div>
        </div>
    );
}
