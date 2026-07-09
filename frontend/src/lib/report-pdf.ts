import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportSheetsToExcel } from "@/lib/export";
import type { FinanceMonthlyReport } from "@/lib/api/finance-analytics";

const num = (n: number) => Math.round(Number(n) || 0).toLocaleString("id-ID");
const rp = (n: number) => "Rp " + num(n);
const W = 210;

/** Bangun & unduh PDF laporan keuangan bulanan owner (ringkasan → analisa → tren → tabel → anomali). */
export function buildMonthlyReportPDF(d: FinanceMonthlyReport) {
    const doc = new jsPDF("portrait");
    const Y = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // ── Header ──
    doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text("LAPORAN KEUANGAN BULANAN", W / 2, 16, { align: "center" });
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text(`Voliko Digital Printing${d.branchName ? " — " + d.branchName : " — Semua Cabang"}`, W / 2, 23, { align: "center" });
    doc.text(`${d.period.monthLabel} ${d.period.year}`, W / 2, 29, { align: "center" });

    // ── Ringkasan angka ──
    autoTable(doc, {
        startY: 35,
        head: [["RINGKASAN", "Nilai"]],
        body: [
            ["Omzet (uang masuk)", rp(d.summary.income)],
            ["Pengeluaran (uang keluar)", rp(d.summary.expense)],
            ["Laba / Rugi (kas)", rp(d.summary.net)],
            ["Margin", `${d.summary.margin}%`],
            ["Sisa Piutang", rp(d.summary.receivables.sisa)],
        ],
        theme: "grid", styles: { fontSize: 9 }, headStyles: { fillColor: [39, 174, 96], textColor: 255 }, columnStyles: { 1: { halign: "right" } },
    });

    // ── ANALISA OTOMATIS (naratif) ──
    const groups: [string, string[]][] = [
        ["Ringkasan Eksekutif", d.analysis.executive],
        ["Perkembangan Perusahaan", d.analysis.growth],
        ["Efisiensi Biaya", d.analysis.efficiency],
        ["Kesehatan Arus Kas", d.analysis.cashHealth],
        ["Peringatan", d.analysis.warnings],
        ["Rekomendasi", d.analysis.recommendations],
    ];
    let yy = Y() + 8;
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("ANALISA OTOMATIS", 14, yy); yy += 6;
    doc.setFontSize(9);
    for (const [title, lines] of groups) {
        if (!lines.length) continue;
        if (yy > 265) { doc.addPage(); yy = 16; }
        doc.setFont("helvetica", "bold"); doc.text(title, 14, yy); yy += 5;
        doc.setFont("helvetica", "normal");
        for (const line of lines) {
            const wrapped = doc.splitTextToSize(`• ${line}`, W - 28) as string[];
            if (yy + wrapped.length * 4.5 > 285) { doc.addPage(); yy = 16; }
            doc.text(wrapped, 16, yy); yy += wrapped.length * 4.5 + 1;
        }
        yy += 2;
    }

    // ── Perkembangan (tabel tren) ──
    doc.addPage();
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("PERKEMBANGAN PERUSAHAAN (6 BULAN)", W / 2, 16, { align: "center" });
    autoTable(doc, {
        startY: 22,
        head: [["Bulan", "Omzet", "Pengeluaran", "Laba", "Margin"]],
        body: d.trend.months.map((mo) => [mo.label, num(mo.income), num(mo.expense), num(mo.net), `${mo.margin}%`]),
        theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [52, 73, 94], textColor: 255 },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    });

    // ── Pendapatan per kanal + Pengeluaran per kategori ──
    autoTable(doc, {
        startY: Y() + 8,
        head: [["Pendapatan per Kanal", "Jumlah"]],
        body: [...d.summary.incomeChannels.map((c) => [c.channel, num(c.total)]), ["TOTAL", num(d.summary.income)]],
        theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [39, 174, 96], textColor: 255 }, columnStyles: { 1: { halign: "right" } },
    });
    autoTable(doc, {
        startY: Y() + 6,
        head: [["Pengeluaran per Kategori", "Jumlah", "%"]],
        body: [...d.summary.expenseCategories.map((c) => [c.category, num(c.amount), `${c.pct}%`]), ["TOTAL", num(d.summary.expense), "100%"]],
        theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [192, 57, 43], textColor: 255 }, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });

    // ── Anomali (bila ada) ──
    if (d.anomalies.items.length) {
        doc.addPage();
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text("PERGERAKAN UANG YANG PERLU DICEK", W / 2, 16, { align: "center" });
        autoTable(doc, {
            startY: 22,
            head: [["Tanggal", "Tingkat", "Keterangan", "Nilai"]],
            body: d.anomalies.items.map((a) => [a.date, a.severity.toUpperCase(), a.reason, num(a.amount)]),
            theme: "striped", styles: { fontSize: 8 }, headStyles: { fillColor: [241, 196, 15], textColor: 0 }, columnStyles: { 3: { halign: "right" } },
        });
    }

    doc.save(`Laporan_Bulanan_${(d.branchName || "SemuaCabang").replace(/\s+/g, "_")}_${d.period.monthLabel}_${d.period.year}.pdf`);
}

/** Bangun & unduh Excel laporan keuangan bulanan owner (multi-sheet). */
export function buildMonthlyReportExcel(d: FinanceMonthlyReport) {
    const title = `${d.branchName || "Semua Cabang"} — ${d.period.monthLabel} ${d.period.year}`;

    const ringkasan: (string | number)[][] = [
        ["LAPORAN KEUANGAN BULANAN"], [title], [],
        ["RINGKASAN", "Nilai"],
        ["Omzet (uang masuk)", d.summary.income],
        ["Pengeluaran (uang keluar)", d.summary.expense],
        ["Laba / Rugi (kas)", d.summary.net],
        ["Margin (%)", d.summary.margin],
        ["Sisa Piutang", d.summary.receivables.sisa],
    ];

    const analisa: (string | number)[][] = [
        ["ANALISA OTOMATIS"], [title], [],
        ...([
            ["Ringkasan Eksekutif", d.analysis.executive],
            ["Perkembangan Perusahaan", d.analysis.growth],
            ["Efisiensi Biaya", d.analysis.efficiency],
            ["Kesehatan Arus Kas", d.analysis.cashHealth],
            ["Peringatan", d.analysis.warnings],
            ["Rekomendasi", d.analysis.recommendations],
        ] as [string, string[]][]).flatMap(([head, lines]) => lines.length ? [[head], ...lines.map((l) => ["", l]), []] : []),
    ];

    const perkembangan: (string | number)[][] = [
        ["PERKEMBANGAN PERUSAHAAN (6 BULAN)"], [title], [],
        ["Bulan", "Omzet", "Pengeluaran", "Laba", "Margin (%)"],
        ...d.trend.months.map((mo) => [mo.label, mo.income, mo.expense, mo.net, mo.margin]),
    ];

    const pendapatan: (string | number)[][] = [
        ["Kanal", "Jumlah"],
        ...d.summary.incomeChannels.map((c) => [c.channel, c.total]),
        ["TOTAL", d.summary.income],
    ];

    const pengeluaran: (string | number)[][] = [
        ["Kategori", "Jumlah", "%"],
        ...d.summary.expenseCategories.map((c) => [c.category, c.amount, c.pct]),
        ["TOTAL", d.summary.expense, 100],
    ];

    const perbandingan: (string | number)[][] = [
        ["PERBANDINGAN vs BULAN SEBELUMNYA"], [title], [],
        ["", "Bulan Ini", "Bulan Lalu", "Selisih", "%"],
        ["Omzet", d.summary.income, d.comparison.previous.income, d.comparison.delta.income, d.comparison.delta.incomePct],
        ["Pengeluaran", d.summary.expense, d.comparison.previous.expense, d.comparison.delta.expense, d.comparison.delta.expensePct],
        ["Laba", d.summary.net, d.comparison.previous.net, d.comparison.delta.net, d.comparison.delta.netPct],
        [],
        ["Perubahan Biaya Terbesar", "Bulan Ini", "Bulan Lalu", "Selisih"],
        ...d.comparison.topExpenseChanges.map((c) => [c.category, c.current, c.previous, c.delta]),
    ];

    const sheets: { name: string; aoa: (string | number)[][] }[] = [
        { name: "Ringkasan", aoa: ringkasan },
        { name: "Analisa", aoa: analisa },
        { name: "Perkembangan", aoa: perkembangan },
        { name: "Pendapatan", aoa: pendapatan },
        { name: "Pengeluaran", aoa: pengeluaran },
        { name: "Perbandingan", aoa: perbandingan },
    ];
    if (d.anomalies.items.length) {
        sheets.push({
            name: "Anomali",
            aoa: [
                ["Tanggal", "Tingkat", "Keterangan", "Nilai"],
                ...d.anomalies.items.map((a) => [a.date, a.severity.toUpperCase(), a.reason, a.amount]),
            ],
        });
    }

    exportSheetsToExcel(sheets, `Laporan_Bulanan_${(d.branchName || "SemuaCabang").replace(/\s+/g, "_")}_${d.period.monthLabel}_${d.period.year}.xlsx`);
}
