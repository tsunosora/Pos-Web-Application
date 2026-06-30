"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BookOpen, Download, FileText, Loader2, Building2 } from "lucide-react";
import api from "@/lib/api/client";
import { getMonthlyClosing, type MonthlyClosing } from "@/lib/api/reports";
import { exportSheetsToExcel } from "@/lib/export";
import { useBranchStore } from "@/store/branch-store";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const rp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const num = (n: number) => Math.round(Number(n) || 0).toLocaleString("id-ID");
const shortWeek = (label: string) => label.split(" ")[0]; // "01–03 Mei 2026" → "01–03"

// ── Excel (multi-sheet, rapi) ───────────────────────────────────────────────
function buildExcel(d: MonthlyClosing) {
    const wl = d.period.weekLabels.map(shortWeek);
    const colSum = (arr: { weeks: number[] }[], i: number) => arr.reduce((s, c) => s + (c.weeks[i] || 0), 0);
    const title = `${d.branchName || "Semua Cabang"} — ${d.period.monthLabel} ${d.period.year}`;

    const pendapatan: any[][] = [
        ["LAPORAN TUTUP BUKU"], [title], [],
        ["PENDAPATAN", ...wl, "Total"],
        ...d.income.channels.map(c => [c.channel, ...c.weeks, c.total]),
        ["TOTAL", ...wl.map((_, i) => colSum(d.income.channels, i)), d.income.total],
    ];
    const pengeluaran: any[][] = [
        ["PENGELUARAN", ...wl, "Total"],
        ...d.expense.categories.map(c => [c.category, ...c.weeks, c.total]),
        ["TOTAL", ...wl.map((_, i) => colSum(d.expense.categories, i)), d.expense.total],
    ];
    const neraca: any[][] = [
        ["NERACA RUGI / LABA"], [title], [],
        ["Pendapatan (uang masuk)", d.income.total],
        [],
        ["Pengeluaran:"],
        ...d.expense.categories.map(c => [`  ${c.category}`, c.total]),
        ["Total Pengeluaran", d.expense.total],
        [],
        ["LABA / RUGI (kas)", d.profit],
    ];
    const rincian: any[][] = [
        ["Tanggal", "Kategori", "Keterangan", "Kanal", "Jumlah"],
        ...d.expense.categories.flatMap(c => c.details.map(x => [dayjs(x.date).format("DD/MM/YYYY"), c.category, x.keterangan, x.channel, x.amount])),
    ];
    const piutang: any[][] = [
        ["Nama", "Keterangan", "Jumlah Piutang", "DP", "Sisa Piutang", "Status"],
        ...d.receivables.rows.map(r => [r.name, r.keterangan, r.jumlah, r.dp, r.sisa, r.status]),
        [],
        ["TOTAL", "", d.receivables.gross, d.receivables.dp, d.receivables.sisa, ""],
    ];

    exportSheetsToExcel([
        { name: "Pendapatan", aoa: pendapatan, merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: wl.length + 1 } }] },
        { name: "Pengeluaran", aoa: pengeluaran },
        { name: "Neraca Rugi-Laba", aoa: neraca },
        { name: "Rincian Pengeluaran", aoa: rincian },
        { name: "Piutang", aoa: piutang },
    ], `Tutup_Buku_${(d.branchName || "Cabang").replace(/\s+/g, "_")}_${d.period.monthLabel}_${d.period.year}.xlsx`);
}

// ── PDF (mirip format manual) ───────────────────────────────────────────────
function buildPDF(d: MonthlyClosing) {
    const doc = new jsPDF("portrait");
    const wl = d.period.weekLabels.map(shortWeek);
    const colSum = (arr: { weeks: number[] }[], i: number) => arr.reduce((s, c) => s + (c.weeks[i] || 0), 0);
    const W = 210;

    doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text("LAPORAN TUTUP BUKU", W / 2, 16, { align: "center" });
    doc.setFontSize(11);
    doc.text(`Voliko Digital Printing${d.branchName ? " — " + d.branchName : ""}`, W / 2, 23, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`${d.period.monthLabel} ${d.period.year}`, W / 2, 29, { align: "center" });

    const moneyCols = (n: number) => { const c: any = {}; for (let i = 1; i <= n; i++) c[i] = { halign: "right" }; return c; };

    autoTable(doc, {
        startY: 35,
        head: [["PENDAPATAN", ...wl, "Total"]],
        body: [
            ...d.income.channels.map(c => [c.channel, ...c.weeks.map(num), num(c.total)]),
            ["TOTAL", ...wl.map((_, i) => num(colSum(d.income.channels, i))), num(d.income.total)],
        ],
        theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [39, 174, 96], textColor: 255 },
        columnStyles: moneyCols(wl.length + 1), footStyles: { fontStyle: "bold" },
    });

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["PENGELUARAN", ...wl, "Total"]],
        body: [
            ...d.expense.categories.map(c => [c.category, ...c.weeks.map(num), num(c.total)]),
            ["TOTAL", ...wl.map((_, i) => num(colSum(d.expense.categories, i))), num(d.expense.total)],
        ],
        theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [192, 57, 43], textColor: 255 },
        columnStyles: moneyCols(wl.length + 1),
    });

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["NERACA RUGI / LABA", "Jumlah"]],
        body: [
            ["Pendapatan (uang masuk)", num(d.income.total)],
            ["Total Pengeluaran", num(d.expense.total)],
            ["LABA / RUGI (kas)", num(d.profit)],
        ],
        theme: "grid", styles: { fontSize: 9 }, headStyles: { fillColor: [241, 196, 15], textColor: 0 },
        columnStyles: { 1: { halign: "right" } },
    });

    // Rincian pengeluaran
    const rincianBody = d.expense.categories.flatMap(c => c.details.map(x => [dayjs(x.date).format("DD/MM/YY"), c.category, x.keterangan, x.channel, num(x.amount)]));
    if (rincianBody.length) {
        doc.addPage();
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text("RINCIAN PENGELUARAN", W / 2, 16, { align: "center" });
        autoTable(doc, {
            startY: 22,
            head: [["Tanggal", "Kategori", "Keterangan", "Kanal", "Jumlah"]],
            body: rincianBody,
            theme: "striped", styles: { fontSize: 8 }, headStyles: { fillColor: [52, 73, 94], textColor: 255 },
            columnStyles: { 4: { halign: "right" } },
        });
    }

    // Piutang
    if (d.receivables.rows.length) {
        doc.addPage();
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text("RINCIAN PIUTANG", W / 2, 16, { align: "center" });
        autoTable(doc, {
            startY: 22,
            head: [["Nama", "Keterangan", "Jumlah", "DP", "Sisa", "Status"]],
            body: d.receivables.rows.map(r => [r.name, r.keterangan, num(r.jumlah), num(r.dp), num(r.sisa), r.status]),
            foot: [["TOTAL", "", num(d.receivables.gross), num(d.receivables.dp), num(d.receivables.sisa), ""]],
            theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [241, 196, 15], textColor: 0 },
            columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
            footStyles: { fontStyle: "bold", fillColor: [230, 230, 230], textColor: 0 },
        });
    }

    doc.save(`Tutup_Buku_${(d.branchName || "Cabang").replace(/\s+/g, "_")}_${d.period.monthLabel}_${d.period.year}.pdf`);
}

export default function TutupBukuPage() {
    const { isManager } = useCurrentUser();
    const activeBranchId = useBranchStore(s => s.activeBranchId);
    const setActiveBranchId = useBranchStore(s => s.setActiveBranchId);
    const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
    const [y, m] = useMemo(() => month.split("-").map(Number), [month]);

    const { data: branches } = useQuery({
        queryKey: ["active-branches"],
        queryFn: async () => (await api.get("/company-branches/active")).data as { id: number; name: string }[],
        staleTime: 5 * 60 * 1000,
    });
    const closingQ = useQuery({
        queryKey: ["tutup-buku", y, m, activeBranchId],
        queryFn: () => getMonthlyClosing(y, m),
    });
    const d = closingQ.data;

    return (
        <div className="space-y-5 max-w-5xl mx-auto pb-8">
            <div className="flex items-start gap-3">
                <span className="h-11 w-11 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0"><BookOpen className="h-6 w-6" /></span>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Tutup Buku Bulanan</h1>
                    <p className="text-sm text-muted-foreground">Laporan akhir bulan (basis kas): pendapatan per kanal, pengeluaran per kategori, laba & piutang. Export PDF / Excel.</p>
                </div>
            </div>

            {/* Filter */}
            <div className="bg-card rounded-2xl border border-border p-3 sm:p-4 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-sm">
                    <span className="text-xs font-semibold text-muted-foreground">Bulan</span>
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground" />
                </label>
                {branches && branches.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <select value={activeBranchId ?? "all"} onChange={e => setActiveBranchId(e.target.value === "all" ? null : Number(e.target.value))}
                            className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground">
                            <option value="all">Semua Cabang</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </label>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => d && buildExcel(d)} disabled={!d}
                        className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-50">
                        <Download className="h-4 w-4" /> Excel
                    </button>
                    <button onClick={() => d && buildPDF(d)} disabled={!d}
                        className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 disabled:opacity-50">
                        <FileText className="h-4 w-4" /> PDF
                    </button>
                </div>
            </div>

            {activeBranchId == null && (
                <p className="text-xs text-amber-600 dark:text-amber-300">Tip: pilih <strong>cabang spesifik</strong> agar tutup buku per cabang (seperti format Voliko). Mode Semua Cabang menggabungkan semuanya.</p>
            )}

            {closingQ.isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !d ? (
                <div className="text-center py-16 text-muted-foreground">Gagal memuat data.</div>
            ) : (
                <>
                    {/* Ringkasan angka */}
                    <div className="grid grid-cols-3 gap-3">
                        <Card label="Pendapatan" value={rp(d.income.total)} cls="text-emerald-600 dark:text-emerald-300" />
                        <Card label="Pengeluaran" value={rp(d.expense.total)} cls="text-red-600 dark:text-red-300" />
                        <Card label="Laba / Rugi (kas)" value={rp(d.profit)} cls={d.profit >= 0 ? "text-indigo-600 dark:text-indigo-300" : "text-red-600 dark:text-red-300"} />
                    </div>

                    <Section title="Pendapatan per Kanal">
                        <PreviewTable
                            head={["Kanal", ...d.period.weekLabels.map(shortWeek), "Total"]}
                            rows={d.income.channels.map(c => [c.channel, ...c.weeks.map(num), num(c.total)])}
                            foot={["TOTAL", ...d.period.weekLabels.map((_, i) => num(d.income.channels.reduce((s, c) => s + c.weeks[i], 0))), num(d.income.total)]}
                        />
                    </Section>

                    <Section title="Pengeluaran per Kategori">
                        {d.expense.categories.length === 0 ? <Empty /> : (
                            <PreviewTable
                                head={["Kategori", ...d.period.weekLabels.map(shortWeek), "Total"]}
                                rows={d.expense.categories.map(c => [c.category, ...c.weeks.map(num), num(c.total)])}
                                foot={["TOTAL", ...d.period.weekLabels.map((_, i) => num(d.expense.categories.reduce((s, c) => s + c.weeks[i], 0))), num(d.expense.total)]}
                            />
                        )}
                    </Section>

                    <Section title={`Piutang (outstanding s/d ${d.period.monthLabel})`}>
                        {d.receivables.rows.length === 0 ? <Empty /> : (
                            <PreviewTable
                                head={["Nama", "Keterangan", "Jumlah", "DP", "Sisa", "Status"]}
                                rows={d.receivables.rows.map(r => [r.name, r.keterangan, num(r.jumlah), num(r.dp), num(r.sisa), r.status])}
                                foot={["TOTAL", "", num(d.receivables.gross), num(d.receivables.dp), num(d.receivables.sisa), ""]}
                            />
                        )}
                    </Section>

                    <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                        <strong>Basis kas:</strong> Pendapatan = uang yang masuk (Cashflow INCOME per kanal). Pengeluaran = uang keluar per kategori (Cashflow EXPENSE). Laba = pendapatan − pengeluaran (bukan laba akrual/HPP). Piutang = transaksi belum lunas (PENDING/PARTIAL) per akhir bulan. {!isManager && "Data mengikuti cabang yang dipilih."}
                    </div>
                </>
            )}
        </div>
    );
}

function Card({ label, value, cls }: { label: string; value: string; cls?: string }) {
    return (
        <div className="bg-card rounded-xl border border-border p-3.5">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-base sm:text-lg font-bold leading-tight ${cls || "text-foreground"}`}>{value}</div>
        </div>
    );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card rounded-2xl border border-border p-4">
            <h2 className="font-semibold text-foreground mb-3">{title}</h2>
            {children}
        </div>
    );
}
function Empty() { return <div className="text-sm text-muted-foreground py-3 text-center">Tidak ada data.</div>; }
function PreviewTable({ head, rows, foot }: { head: string[]; rows: (string | number)[][]; foot?: (string | number)[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
                <thead><tr className="text-[10px] text-muted-foreground border-b border-border">
                    {head.map((h, i) => <th key={i} className={`py-1.5 px-2 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}
                </tr></thead>
                <tbody>
                    {rows.map((r, ri) => (
                        <tr key={ri} className="border-b border-border/60 last:border-0">
                            {r.map((c, ci) => <td key={ci} className={`py-1.5 px-2 ${ci === 0 ? "text-left font-medium text-foreground" : "text-right font-mono text-muted-foreground"}`}>{c}</td>)}
                        </tr>
                    ))}
                </tbody>
                {foot && <tfoot><tr className="border-t-2 border-border font-semibold">
                    {foot.map((c, ci) => <td key={ci} className={`py-1.5 px-2 ${ci === 0 ? "text-left" : "text-right font-mono"} text-foreground`}>{c}</td>)}
                </tr></tfoot>}
            </table>
        </div>
    );
}
