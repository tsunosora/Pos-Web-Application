"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Loader2, Check, Trophy, Settings2, AlertTriangle, ShieldCheck, Factory } from "lucide-react";
import {
    getBonusTargets, upsertBonusTarget, getBonusAchievement, upsertBonusAdjustment,
    type BonusTarget, type BonusRole, type BonusRoleResult, type BonusEmployee,
} from "@/lib/api/bonus";

const ROLES: { role: BonusRole; label: string; metric: string; hint: string }[] = [
    { role: "CS", label: "Customer Service", metric: "Omzet (Rp)", hint: "Imogiri 105.4jt/52.7jt · Sewon 51.5jt/25.75jt" },
    { role: "DESIGNER", label: "Designer", metric: "Design ACC (jumlah)", hint: "isi target jumlah Design ACC" },
    { role: "OPERATOR", label: "Operator", metric: "Nota / transaksi (jumlah)", hint: "isi target jumlah nota cabang" },
];

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">{label}</label>
            <input type="number" min={0} value={value} onChange={e => onChange(e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-xs font-mono bg-background text-foreground" />
        </div>
    );
}
const fmtMetric = (role: BonusRole, v: number) => role === "CS" ? fmtRp(v) : String(Math.round(Number(v) || 0));

export function BonusPanel({ branches, activeBranchId }: { branches: { id: number; name: string }[]; activeBranchId: number | null }) {
    const qc = useQueryClient();
    const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
    const branchId = activeBranchId;

    const targetsQ = useQuery({ queryKey: ["bonus-targets", branchId], queryFn: () => getBonusTargets(branchId!), enabled: branchId != null });
    const achQ = useQuery({ queryKey: ["bonus-ach", branchId, month], queryFn: () => getBonusAchievement(branchId!, month), enabled: branchId != null });

    const adjMut = useMutation({
        mutationFn: upsertBonusAdjustment,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus-ach", branchId, month] }),
    });

    if (branchId == null) {
        return (
            <div className="rounded-2xl glass p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-1"><Trophy className="h-5 w-5 text-amber-500" /><h2 className="font-bold text-base text-foreground">Bonus Karyawan</h2></div>
                <p className="text-sm text-muted-foreground">Pilih <strong>cabang spesifik</strong> di filter atas (bukan mode Semua Cabang) untuk mengatur &amp; melihat bonus per cabang.</p>
            </div>
        );
    }

    const targetByRole = new Map<string, BonusTarget>((targetsQ.data || []).map(t => [t.role, t]));
    const roles = achQ.data?.roles;

    const toggle = (r: BonusRoleResult, e: BonusEmployee, field: "qualityEligible" | "forfeited") => {
        adjMut.mutate({
            branchId: branchId!, role: r.role, employeeName: e.name, periodMonth: month,
            qualityEligible: field === "qualityEligible" ? !e.qualityEligible : e.qualityEligible,
            forfeited: field === "forfeited" ? !e.forfeited : e.forfeited,
        });
    };

    return (
        <div className="space-y-4">
            {/* Pengaturan Bonus */}
            <div className="rounded-2xl glass p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                    <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Settings2 className="h-5 w-5" /></span>
                    <div>
                        <h2 className="font-bold text-base text-foreground">Pengaturan Bonus — {branches.find(b => b.id === branchId)?.name || "Cabang"}</h2>
                        <p className="text-xs text-muted-foreground">Target & nominal bonus per posisi. Bonus dievaluasi bulanan.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {ROLES.map(r => <TargetCard key={r.role} role={r.role} label={r.label} metric={r.metric} hint={r.hint} branchId={branchId} existing={targetByRole.get(r.role)} />)}
                </div>

                <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                    <Factory className="h-3.5 w-3.5 inline mr-1 text-sky-500" />
                    Reward dihitung <strong>per divisi dari kerja nyata</strong>: Operator = siapa pun yang memproses nota cabang ini; Designer = yang mengerjakan desain (Design ACC); CS = penanganan lead. Satu orang bisa muncul di beberapa divisi. Daftar karyawan + PIN dikelola di <strong>Pengaturan → Kelola Karyawan</strong>.
                </div>
            </div>

            {/* Pencapaian Bonus */}
            <div className="rounded-2xl glass p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center"><Trophy className="h-5 w-5" /></span>
                        <div>
                            <h2 className="font-bold text-base text-foreground">Pencapaian Bonus</h2>
                            <p className="text-xs text-muted-foreground">Pencapaian vs target → bonus yang didapat tiap karyawan.</p>
                        </div>
                    </div>
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground" />
                </div>

                {achQ.isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : !roles ? (
                    <div className="text-sm text-muted-foreground py-6 text-center">Belum ada data.</div>
                ) : (
                    <div className="space-y-4">
                        {(["CS", "DESIGNER", "OPERATOR"] as BonusRole[]).map(role => {
                            const r = roles[role];
                            const info = ROLES.find(x => x.role === role)!;
                            const teamPct = r.targetTim > 0 ? Math.min(100, Math.round((r.teamActual / r.targetTim) * 100)) : 0;
                            return (
                                <div key={role} className="rounded-xl border border-border p-3">
                                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                        <div className="font-semibold text-sm text-foreground">{info.label}</div>
                                        {r.target ? (
                                            <div className="text-xs text-muted-foreground">
                                                Tim: <strong className={r.teamAchieved ? "text-emerald-600 dark:text-emerald-300" : "text-foreground"}>{fmtMetric(role, r.teamActual)}</strong> / {r.targetTim > 0 ? fmtMetric(role, r.targetTim) : "—"}
                                                {r.teamAchieved && <span className="ml-1 text-emerald-600 dark:text-emerald-300">✓ tercapai</span>}
                                            </div>
                                        ) : <span className="text-xs text-amber-600 dark:text-amber-300">target belum diatur</span>}
                                    </div>
                                    {r.target && r.targetTim > 0 && (
                                        <div className="bg-muted rounded-full h-1.5 overflow-hidden mb-2">
                                            <div className={`h-full rounded-full ${r.teamAchieved ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${teamPct}%` }} />
                                        </div>
                                    )}
                                    {r.employees.length === 0 ? (
                                        <div className="text-xs text-muted-foreground py-2">Belum ada karyawan dengan data di bulan ini.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs min-w-[640px]">
                                                <thead><tr className="text-[10px] text-muted-foreground border-b border-border">
                                                    <th className="text-left py-1.5 px-1.5">Karyawan</th>
                                                    <th className="text-right py-1.5 px-1.5">Pencapaian</th>
                                                    <th className="text-center py-1.5 px-1.5">Kualitas</th>
                                                    <th className="text-center py-1.5 px-1.5">Gugur</th>
                                                    <th className="text-right py-1.5 px-1.5">B.Tim</th>
                                                    <th className="text-right py-1.5 px-1.5">B.Pribadi</th>
                                                    <th className="text-right py-1.5 px-1.5">B.Kualitas</th>
                                                    <th className="text-right py-1.5 px-1.5">Total</th>
                                                </tr></thead>
                                                <tbody>
                                                    {r.employees.map(e => (
                                                        <tr key={e.name} className={`border-b border-border/60 last:border-0 ${e.forfeited ? "opacity-60" : ""}`}>
                                                            <td className="py-1.5 px-1.5 font-medium text-foreground truncate max-w-[130px]">{e.name}</td>
                                                            <td className="py-1.5 px-1.5 text-right font-mono">
                                                                <span className={e.personalAchieved ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground"}>{fmtMetric(role, e.actual)}</span>
                                                                {e.personalAchieved && <span className="text-emerald-600 dark:text-emerald-300"> ✓</span>}
                                                            </td>
                                                            <td className="py-1.5 px-1.5 text-center">
                                                                <button onClick={() => toggle(r, e, "qualityEligible")} title="Bonus kualitas layak?" className={`inline-flex p-1 rounded ${e.qualityEligible ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground/40"}`}><ShieldCheck className="h-3.5 w-3.5" /></button>
                                                            </td>
                                                            <td className="py-1.5 px-1.5 text-center">
                                                                <button onClick={() => toggle(r, e, "forfeited")} title="Bonus gugur (pelanggaran piutang)?" className={`inline-flex p-1 rounded ${e.forfeited ? "text-red-600 dark:text-red-300" : "text-muted-foreground/40"}`}><AlertTriangle className="h-3.5 w-3.5" /></button>
                                                            </td>
                                                            <td className="py-1.5 px-1.5 text-right font-mono text-muted-foreground">{e.bonusTim ? fmtRp(e.bonusTim) : "—"}</td>
                                                            <td className="py-1.5 px-1.5 text-right font-mono text-muted-foreground">{e.bonusPribadi ? fmtRp(e.bonusPribadi) : "—"}</td>
                                                            <td className="py-1.5 px-1.5 text-right font-mono text-muted-foreground">{e.bonusKualitas ? fmtRp(e.bonusKualitas) : "—"}</td>
                                                            <td className="py-1.5 px-1.5 text-right font-mono font-semibold text-foreground">{e.total ? fmtRp(e.total) : "—"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <p className="text-[11px] text-muted-foreground">
                            Ikon <ShieldCheck className="h-3 w-3 inline" /> = Bonus Kualitas layak (klik untuk batalkan jika ada komplain valid). <AlertTriangle className="h-3 w-3 inline" /> = tandai bonus gugur (pelanggaran kebijakan piutang) → semua bonus karyawan itu jadi nol.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function TargetCard({ role, label, metric, hint, branchId, existing }: { role: BonusRole; label: string; metric: string; hint: string; branchId: number; existing?: BonusTarget }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        targetTim: existing ? String(existing.targetTim) : "",
        targetPribadi: existing ? String(existing.targetPribadi) : "",
        bonusKualitas: existing ? String(existing.bonusKualitas) : "300000",
        bonusTim: existing ? String(existing.bonusTim) : "300000",
        bonusPribadi: existing ? String(existing.bonusPribadi) : "300000",
        gajiPokok: existing ? String(existing.gajiPokok) : "1800000",
    });
    // Re-sync saat data target termuat/berubah cabang
    const sig = existing ? `${existing.id}:${existing.targetTim}:${existing.targetPribadi}` : `none:${branchId}:${role}`;
    const [lastSig, setLastSig] = useState(sig);
    if (sig !== lastSig) {
        setLastSig(sig);
        setForm({
            targetTim: existing ? String(existing.targetTim) : "",
            targetPribadi: existing ? String(existing.targetPribadi) : "",
            bonusKualitas: existing ? String(existing.bonusKualitas) : "300000",
            bonusTim: existing ? String(existing.bonusTim) : "300000",
            bonusPribadi: existing ? String(existing.bonusPribadi) : "300000",
            gajiPokok: existing ? String(existing.gajiPokok) : "1800000",
        });
    }

    const mut = useMutation({
        mutationFn: () => upsertBonusTarget({
            branchId, role,
            targetTim: Number(form.targetTim) || 0,
            targetPribadi: Number(form.targetPribadi) || 0,
            bonusKualitas: Number(form.bonusKualitas) || 0,
            bonusTim: Number(form.bonusTim) || 0,
            bonusPribadi: Number(form.bonusPribadi) || 0,
            gajiPokok: Number(form.gajiPokok) || 0,
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus-targets", branchId] }),
    });

    const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

    return (
        <div className="rounded-xl border border-border p-3 bg-background/40">
            <div className="font-semibold text-sm text-foreground mb-0.5">{label}</div>
            <div className="text-[10px] text-muted-foreground mb-2">Metrik: {metric} · <span className="italic">{hint}</span></div>
            <div className="grid grid-cols-2 gap-2">
                <NumField label="Target Tim/bln" value={form.targetTim} onChange={v => set("targetTim", v)} />
                <NumField label="Target Pribadi/bln" value={form.targetPribadi} onChange={v => set("targetPribadi", v)} />
                <NumField label="Bonus Tim (Rp)" value={form.bonusTim} onChange={v => set("bonusTim", v)} />
                <NumField label="Bonus Pribadi (Rp)" value={form.bonusPribadi} onChange={v => set("bonusPribadi", v)} />
                <NumField label="Bonus Kualitas (Rp)" value={form.bonusKualitas} onChange={v => set("bonusKualitas", v)} />
                <NumField label="Gaji Pokok (Rp)" value={form.gajiPokok} onChange={v => set("gajiPokok", v)} />
            </div>
            <button onClick={() => mut.mutate()} disabled={mut.isPending}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Simpan
            </button>
        </div>
    );
}
