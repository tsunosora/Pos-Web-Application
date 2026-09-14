import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import { exportSheetsToExcel } from "@/lib/export";
import { LEAD_SOURCE_LABEL, type LeadSource, type LeadStatus } from "@/lib/api/crm";
import { calcItemSubtotal } from "@/components/crm/LeadItemsEditor";

// Label tanpa emoji — font PDF bawaan (Helvetica) tidak bisa menampilkan emoji.
export const EXPORT_STATUS_LABEL: Record<LeadStatus, string> = {
    NEW: "Baru", FOLLOW_UP: "Follow Up", NEGOTIATION: "Negosiasi", CLOSED_WON: "Closing", CLOSED_LOST: "Lost", INVALID: "Invalid",
};
const LEVEL_LABEL: Record<string, string> = { HOT: "Hot", WARM: "Warm", COLD: "Cold" };
const VERDICT_LABEL: Record<string, string> = { BISA: "Bisa", TIDAK_BISA: "Tidak bisa", REVISI: "Revisi" };

const dt = (v?: string | null) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "");
const d = (v?: string | null) => (v ? dayjs(v).format("DD/MM/YYYY") : "");
const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

function sourceText(l: any): string {
    return l.source === "CUSTOM" ? (l.sourceDetail || "Custom") : (LEAD_SOURCE_LABEL[l.source as LeadSource] ?? l.source ?? "");
}

function itemText(it: any): string {
    const w = Number(it.widthCm) || 0;
    const h = Number(it.heightCm) || 0;
    const unit = it.unitType === "m" ? "m" : "cm"; // "cm2" = produk basis cm², ukuran dalam cm
    const size = it.unitType === "menit" && w ? ` ${w} menit` : w && h ? ` ${w}×${h} ${unit}` : "";
    const qty = Number(it.quantity) > 1 ? ` ×${it.quantity}` : "";
    const price = Number(it.unitPrice) ? ` @${rp(Number(it.unitPrice))}` : "";
    const note = it.note ? ` (${String(it.note).trim()})` : "";
    return `${it.description ?? "Item"}${size}${qty}${price}${note}`;
}

export interface LeadExportTable {
    headers: string[];
    rows: (string | number)[][];
}

/** Tabel lengkap utk CSV/Excel. Nilai rupiah & menit dibiarkan angka supaya bisa dijumlah di spreadsheet. */
export function buildLeadExportTable(leads: any[]): LeadExportTable {
    const headers = [
        "No", "ID Lead", "Tanggal Masuk", "Nama", "No. HP", "Kota", "Sumber", "Detail Sumber", "Label Iklan", "Kampanye Iklan",
        "Status Pipeline", "Level", "Kebutuhan", "Estimasi Nilai (Rp)", "Item Pesanan", "Total Item (Rp)",
        "CS Penanggung Jawab", "Dibuat Oleh", "Cabang", "Desainer", "Hasil Cek Desain", "Respons Pertama (menit)",
        "Jadwal Follow-up", "Deadline Kirim", "Tanggal Closing/Lost", "Alasan Lost", "Pelanggan Terdaftar", "No. SO",
        "Jumlah Aktivitas", "Aktivitas Terakhir", "Terakhir Diperbarui",
    ];
    const rows = leads.map((l, i) => {
        const items: any[] = l.items ?? [];
        const itemsTotal = items.reduce((sum, it) => sum + calcItemSubtotal({ ...it, unitPrice: Number(it.unitPrice) }), 0);
        const masuk = l.intakeAt || l.createdAt;
        const respons = l.firstResponseAt && masuk
            ? Math.max(0, Math.round((new Date(l.firstResponseAt).getTime() - new Date(masuk).getTime()) / 60000))
            : "";
        const last = l.activities?.[0];
        return [
            i + 1,
            String(l.id),
            dt(masuk),
            l.name ?? "",
            l.phone ?? "",
            l.city ?? "",
            sourceText(l),
            l.source === "CUSTOM" ? "" : (l.sourceDetail ?? ""),
            l.adLabel?.name ?? "",
            l.adCampaignName ?? "",
            EXPORT_STATUS_LABEL[l.status as LeadStatus] ?? l.status ?? "",
            LEVEL_LABEL[l.level] ?? l.level ?? "",
            (l.needs ?? "").trim(),
            l.estimatedValue != null ? Number(l.estimatedValue) : "",
            items.map(itemText).join(" | "),
            items.length ? Math.round(itemsTotal) : "",
            l.assignedTo?.name ?? "",
            l.createdBy?.name ?? "",
            l.branch ? (l.branch.code ? `${l.branch.name} (${l.branch.code})` : l.branch.name) : "",
            l.designerName ?? "",
            VERDICT_LABEL[l.designVerdict] ?? (l.designVerdict ?? ""),
            respons,
            dt(l.followUpDate),
            d(l.deliveryDeadline),
            dt(l.closedAt),
            (l.closeLostReason ?? "").trim(),
            l.convertedCustomer ? `${l.convertedCustomer.name}${l.convertedCustomer.phone ? ` (${l.convertedCustomer.phone})` : ""}` : "",
            l.convertedSO?.soNumber ?? "",
            l._count?.activities ?? 0,
            last ? `${dt(last.createdAt)} · ${last.kind}${last.text ? `: ${String(last.text).trim()}` : ""}` : "",
            dt(l.updatedAt),
        ];
    });
    return { headers, rows };
}

export interface LeadExportMeta {
    title: string;
    lines: string[];
    summaryAoa: (string | number)[][];
}

/** Keterangan filter + ringkasan per status (dipakai judul PDF & sheet Ringkasan Excel). */
export function buildLeadExportMeta(
    leads: any[],
    opts: { periodText: string; dateFieldText: string; statusText: string; filterText: string },
): LeadExportMeta {
    // Estimasi = isian manual CS (bisa salah ketik); Total item = hitungan dari item pesanan → pembanding.
    const byStatus = new Map<string, { n: number; est: number; item: number }>();
    let est = 0;
    let itemTotal = 0;
    for (const l of leads) {
        const key = EXPORT_STATUS_LABEL[l.status as LeadStatus] ?? l.status;
        const value = Number(l.estimatedValue) || 0;
        const items = (l.items ?? []).reduce((sum: number, it: any) => sum + calcItemSubtotal({ ...it, unitPrice: Number(it.unitPrice) }), 0);
        est += value;
        itemTotal += items;
        const cur = byStatus.get(key) ?? { n: 0, est: 0, item: 0 };
        cur.n++;
        cur.est += value;
        cur.item += items;
        byStatus.set(key, cur);
    }
    const printed = dayjs().format("DD MMMM YYYY HH:mm");
    const perStatus = [...byStatus].map(([k, v]) => `${k} ${v.n.toLocaleString("id-ID")}`).join(", ");
    return {
        title: "Data Lead CRM",
        lines: [
            `Periode: ${opts.periodText} (berdasarkan ${opts.dateFieldText})`,
            `Pipeline: ${opts.statusText}${opts.filterText ? ` · Filter: ${opts.filterText}` : ""}`,
            `Total: ${leads.length.toLocaleString("id-ID")} lead · Estimasi nilai (isian CS): ${rp(est)} · Total item pesanan: ${rp(itemTotal)}${perStatus ? ` · ${perStatus}` : ""}`,
            `Dicetak: ${printed}`,
        ],
        summaryAoa: [
            ["Data Lead CRM"],
            ["Periode", `${opts.periodText} (berdasarkan ${opts.dateFieldText})`],
            ["Pipeline", opts.statusText],
            ["Filter", opts.filterText || "-"],
            ["Dicetak", printed],
            [],
            ["Status", "Jumlah Lead", "Estimasi Nilai (Rp)", "Total Item Pesanan (Rp)"],
            ...[...byStatus].map(([k, v]) => [k, v.n, Math.round(v.est), Math.round(v.item)]),
            ["Total", leads.length, Math.round(est), Math.round(itemTotal)],
        ],
    };
}

// Pemisah TITIK KOMA: Excel dengan regional Indonesia memakai ";" sebagai pemisah daftar — dengan koma,
// seluruh baris masuk ke kolom A. Google Sheets/LibreOffice mendeteksi ";" otomatis.
const CSV_SEP = ";";

// Cegah formula injection saat CSV dibuka di Excel (nama pelanggan "=..." dsb). Nomor HP "+62..." dibiarkan.
// Baris baru di dalam teks (catatan multi-baris) diratakan jadi " / " supaya 1 lead = 1 baris.
const csvCell = (v: unknown) => {
    let s = v == null ? "" : String(v).replace(/\s*[\r\n]+\s*/g, " / ");
    if (/^[=@]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s().-]+$/.test(s))) s = `'${s}`;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// No. HP ditulis ="+62..." supaya Excel memperlakukannya sebagai teks (tanpa itu jadi 6,28E+12 dan "+" hilang).
const phoneCell = (v: unknown) => {
    const s = v == null ? "" : String(v).trim();
    return /^\+?\d[\d\s-]{5,}$/.test(s) ? `"=""${s}"""` : csvCell(s);
};

/** CSV UTF-8 ber-BOM (karakter "×", "·" terbaca benar di Excel), pemisah ";". */
export function toLeadCsv(t: LeadExportTable): string {
    const phoneCol = t.headers.indexOf("No. HP");
    const line = (r: (string | number)[], isHeader: boolean) =>
        r.map((v, i) => (!isHeader && i === phoneCol ? phoneCell(v) : csvCell(v))).join(CSV_SEP);
    return "\uFEFF" + [line(t.headers, true), ...t.rows.map((r) => line(r, false))].join("\r\n") + "\r\n";
}

export function downloadLeadsCsv(t: LeadExportTable, fileName: string) {
    saveAs(new Blob([toLeadCsv(t)], { type: "text/csv;charset=utf-8" }), fileName);
}

export function downloadLeadsXlsx(t: LeadExportTable, meta: LeadExportMeta, fileName: string) {
    const objects = t.rows.map((r) => Object.fromEntries(t.headers.map((h, i) => [h, r[i]])));
    exportSheetsToExcel([{ name: "Data Lead", rows: objects }, { name: "Ringkasan", aoa: meta.summaryAoa }], fileName);
}

// Font PDF bawaan hanya Latin-1: buang emoji/karakter lain supaya tidak jadi simbol aneh.
const pdfSafe = (v: unknown) =>
    String(v ?? "").replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022]/g, "").replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

/** PDF A4 lanskap: kolom inti + ringkasan filter di atas + nomor halaman. */
export function downloadLeadsPdf(leads: any[], meta: LeadExportMeta, fileName: string) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text(pdfSafe(meta.title), 8, 12);
    doc.setFontSize(8);
    doc.setTextColor(90);
    meta.lines.forEach((line, i) => doc.text(pdfSafe(line), 8, 17.5 + i * 4));

    const head = [["No", "Tgl Masuk", "Nama", "No. HP", "Kota", "Sumber", "Status", "Level", "Kebutuhan & Item", "Estimasi", "CS", "Follow-up", "Closing/Lost"]];
    const body = leads.map((l, i) => {
        const items = (l.items ?? []).map(itemText).join("; ");
        const needs = [String(l.needs ?? "").trim(), items].filter(Boolean).join(" — ");
        const closing = l.closedAt
            ? `${d(l.closedAt)}${l.status === "CLOSED_LOST" && l.closeLostReason ? ` (${l.closeLostReason})` : ""}`
            : "";
        return [
            String(i + 1),
            dt(l.intakeAt || l.createdAt),
            pdfSafe(l.name),
            pdfSafe(l.phone),
            pdfSafe(l.city),
            pdfSafe(sourceText(l)),
            EXPORT_STATUS_LABEL[l.status as LeadStatus] ?? String(l.status ?? ""),
            LEVEL_LABEL[l.level] ?? "",
            clip(pdfSafe(needs), 260),
            l.estimatedValue != null ? rp(Number(l.estimatedValue)) : "",
            pdfSafe(l.assignedTo?.name),
            d(l.followUpDate),
            clip(pdfSafe(closing), 90),
        ];
    });
    autoTable(doc, {
        startY: 17.5 + meta.lines.length * 4 + 1.5,
        head,
        body,
        theme: "striped",
        styles: { fontSize: 6.6, cellPadding: 1.2, overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold", fontSize: 7 },
        columnStyles: {
            0: { cellWidth: 7, halign: "right" }, 1: { cellWidth: 19 }, 2: { cellWidth: 28 }, 3: { cellWidth: 24 },
            4: { cellWidth: 18 }, 5: { cellWidth: 20 }, 6: { cellWidth: 16 }, 7: { cellWidth: 11 }, 8: { cellWidth: 62 },
            9: { cellWidth: 20, halign: "right" }, 10: { cellWidth: 20 }, 11: { cellWidth: 17 }, 12: { cellWidth: 19 },
        },
        margin: { left: 8, right: 8, top: 10, bottom: 12 },
    });
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(140);
        doc.text(`Hal ${p} dari ${pages}`, 289, 205, { align: "right" });
    }
    doc.save(fileName);
}
