// frontend/src/lib/thermal/receipt-thermal.ts
// Layout struk thermal 58mm (384px). Dipakai untuk raster (html2canvas) & browser-print.
import type { ReceiptSnapshot } from '../receipt';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

const esc = (s: unknown) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] || c);

/** Baris dimensi untuk item AREA_BASED (m²/menit). */
const dimLine = (it: ReceiptSnapshot['items'][number]): string => {
  if (it.pricingMode !== 'AREA_BASED') return '';
  const u = it.unitType || 'm';
  const body = u === 'menit' ? `${it.widthCm} mnt` : `${it.widthCm}×${it.heightCm} ${u}`;
  const pcs = it.pcs && it.pcs > 1 ? ` ×${it.pcs}` : '';
  return `<div class="sub">${esc(body + pcs)}</div>`;
};

/** Hanya isi <div.receipt> — dipakai html2canvas & preview React. Lebar tetap 384px. */
export const buildThermalReceiptBody = (
  snap: ReceiptSnapshot,
  status: 'TAGIHAN' | 'LUNAS',
): string => {
  const dateStr = snap.timestamp.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  const items = snap.items
    .map((it) => {
      const note = it.note ? `<div class="sub i">${esc(it.note)}</div>` : '';
      return `<div class="it"><div class="nm">${esc(it.name)}</div>${dimLine(it)}${note}
      <div class="row"><span>${it.qty} x ${rp(it.pricePerUnit)}</span><span>${rp(it.price)}</span></div></div>`;
    })
    .join('');

  const hasDp = snap.downPayment != null && snap.downPayment < snap.grandTotal;
  const dpRows = hasDp
    ? `<div class="row"><span>DP</span><span>${rp(snap.downPayment!)}</span></div>
       <div class="row b"><span>Sisa</span><span>${rp(snap.grandTotal - snap.downPayment!)}</span></div>`
    : '';

  const pm =
    snap.paymentMethod === 'BANK_TRANSFER'
      ? 'Transfer Bank'
      : snap.paymentMethod === 'QRIS'
        ? 'QRIS'
        : snap.paymentMethod === 'CASH'
          ? 'Tunai'
          : snap.paymentMethod;

  return `<div class="receipt">
    ${snap.logoUrl ? `<img class="logo" src="${API_BASE}${esc(snap.logoUrl)}" crossorigin="anonymous"/>` : ''}
    <div class="store">${esc(snap.storeName)}</div>
    ${snap.branchLabel ? `<div class="sub">${esc(snap.branchLabel)}</div>` : ''}
    ${snap.storeAddress ? `<div class="sub">${esc(snap.storeAddress)}</div>` : ''}
    ${snap.storePhone ? `<div class="sub">${esc(snap.storePhone)}</div>` : ''}
    ${snap.notaHeader ? `<div class="sub i">${esc(snap.notaHeader)}</div>` : ''}
    <div class="hr"></div>
    <div class="row"><span>No. SO</span><span>${esc(snap.orderNumber || '-')}</span></div>
    ${snap.checkoutNumber ? `<div class="row"><span>No. CO</span><span>${esc(snap.checkoutNumber)}</span></div>` : ''}
    <div class="row"><span>Tgl</span><span>${esc(dateStr)}</span></div>
    ${snap.cashierName ? `<div class="row"><span>Kasir</span><span>${esc(snap.cashierName)}</span></div>` : ''}
    ${snap.customerName ? `<div class="row"><span>Plgn</span><span>${esc(snap.customerName)}</span></div>` : ''}
    ${snap.customerPhone ? `<div class="row"><span>HP</span><span>${esc(snap.customerPhone)}</span></div>` : ''}
    ${snap.productionBranchLabel ? `<div class="sub b">Diambil di: ${esc(snap.productionBranchLabel)}</div>` : ''}
    <div class="hr"></div>
    ${items}
    <div class="summary">
      <div class="hr"></div>
      <div class="row"><span>Subtotal</span><span>${rp(snap.subtotal)}</span></div>
      ${snap.discount ? `<div class="row"><span>Diskon</span><span>-${rp(snap.discount)}</span></div>` : ''}
      ${snap.taxAmount ? `<div class="row"><span>Pajak ${snap.taxRate.toFixed(0)}%</span><span>${rp(snap.taxAmount)}</span></div>` : ''}
      ${snap.shippingCost ? `<div class="row"><span>Ongkir</span><span>${rp(snap.shippingCost)}</span></div>` : ''}
      <div class="row total"><span>TOTAL</span><span>${rp(snap.grandTotal)}</span></div>
      ${dpRows}
      <div class="row"><span>Bayar</span><span>${esc(pm)}</span></div>
      <div class="row b"><span>Status</span><span>${esc(status)}</span></div>
      ${status === 'LUNAS' ? `<div class="stamp" aria-label="LUNAS">LUNAS</div>` : ''}
    </div>
    <div class="hr"></div>
    <div class="foot">${esc(snap.notaFooter || 'Terima kasih!')}</div>
  </div>`;
};

// Area cetak 48mm (kertas 55mm) → 376px (47mm, margin aman). Harus SAMA dgn PRINTER_DOTS
// di escpos.ts, kalau tidak html2canvas akan meng-crop konten. Font monospace tebal supaya
// tajam saat di-raster jadi 1-bit.
export const THERMAL_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; }
  .receipt { position:relative; width:376px; padding:12px 12px 14px; font-family:'Courier New',monospace; color:#000; font-size:21px; font-weight:600; line-height:1.5; }
  .store { text-align:center; font-weight:800; font-size:27px; letter-spacing:.5px; margin-bottom:3px; }
  .sub { text-align:center; font-size:17px; font-weight:600; word-break:break-word; line-height:1.45; }
  .logo { display:block; margin:0 auto 6px; max-width:200px; max-height:120px; object-fit:contain; filter:grayscale(1) contrast(1.4); }
  .hr { border-top:2px dashed #000; margin:11px 0; }
  .row { display:flex; justify-content:space-between; gap:12px; align-items:baseline; padding:2px 0; }
  .row span:first-child { flex:0 0 auto; white-space:nowrap; }
  .row span:last-child { flex:1 1 auto; min-width:0; text-align:right; overflow-wrap:anywhere; }
  .it { margin-bottom:9px; }
  .it:last-child { margin-bottom:2px; }
  .nm { font-weight:700; word-break:break-word; margin-bottom:1px; }
  .i { font-style:italic; }
  .b { font-weight:700; }
  .summary { position:relative; }
  .total { font-weight:800; font-size:24px; border-top:2px solid #000; border-bottom:2px solid #000; padding:8px 0; margin:9px 0; }
  .stamp { position:absolute; left:50%; top:56%; transform:translate(-50%,-50%) rotate(-14deg);
           display:inline-block; padding:5px 22px; border:5px double #c81e1e; border-radius:8px;
           color:#c81e1e; font-family:'Arial Black','Arial',sans-serif; font-weight:900; font-size:38px;
           letter-spacing:7px; text-transform:uppercase; opacity:.82; pointer-events:none; white-space:nowrap;
           text-shadow:0 0 1px #c81e1e; }
  .foot { text-align:center; font-size:16px; margin-top:12px; white-space:pre-wrap; }
  @media print { @page { size:55mm auto; margin:0; } body { width:55mm; } .receipt { width:47mm; margin:0 auto; padding:1mm 1.5mm 2mm; font-size:10pt; font-weight:600; line-height:1.5; } .store { font-size:13pt; } .total { font-size:12pt; padding:2mm 0; } .hr { margin:2.4mm 0; } .stamp { font-size:17pt; letter-spacing:2px; padding:1px 10px; border-width:3px; } }
`;

/** HTML dokumen lengkap untuk browser-print 58mm (window.open). */
export const buildThermalReceiptHTML = (
  snap: ReceiptSnapshot,
  status: 'TAGIHAN' | 'LUNAS',
): string =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk ${esc(snap.orderNumber || '')}</title>
  <style>${THERMAL_CSS}</style></head><body>${buildThermalReceiptBody(snap, status)}</body></html>`;
