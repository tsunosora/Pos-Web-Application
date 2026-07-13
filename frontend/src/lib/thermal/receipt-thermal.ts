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
    <div class="row"><span>No</span><span>${esc(snap.orderNumber || '-')}</span></div>
    ${snap.checkoutNumber ? `<div class="row"><span>No.SC</span><span>${esc(snap.checkoutNumber)}</span></div>` : ''}
    <div class="row"><span>Tgl</span><span>${esc(dateStr)}</span></div>
    ${snap.cashierName ? `<div class="row"><span>Kasir</span><span>${esc(snap.cashierName)}</span></div>` : ''}
    ${snap.customerName ? `<div class="row"><span>Plgn</span><span>${esc(snap.customerName)}</span></div>` : ''}
    ${snap.customerPhone ? `<div class="row"><span>HP</span><span>${esc(snap.customerPhone)}</span></div>` : ''}
    ${snap.productionBranchLabel ? `<div class="sub b">Diambil di: ${esc(snap.productionBranchLabel)}</div>` : ''}
    <div class="hr"></div>
    ${items}
    <div class="hr"></div>
    <div class="row"><span>Subtotal</span><span>${rp(snap.subtotal)}</span></div>
    ${snap.discount ? `<div class="row"><span>Diskon</span><span>-${rp(snap.discount)}</span></div>` : ''}
    ${snap.taxAmount ? `<div class="row"><span>Pajak ${snap.taxRate.toFixed(0)}%</span><span>${rp(snap.taxAmount)}</span></div>` : ''}
    ${snap.shippingCost ? `<div class="row"><span>Ongkir</span><span>${rp(snap.shippingCost)}</span></div>` : ''}
    <div class="row total"><span>TOTAL</span><span>${rp(snap.grandTotal)}</span></div>
    ${dpRows}
    <div class="row"><span>Bayar</span><span>${esc(pm)}</span></div>
    <div class="row b"><span>Status</span><span>${status}</span></div>
    <div class="hr"></div>
    <div class="foot">${esc(snap.notaFooter || 'Terima kasih!')}</div>
  </div>`;
};

// 58mm = 384px. Font monospace tebal supaya tajam saat di-raster jadi 1-bit.
export const THERMAL_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; }
  .receipt { width:384px; padding:8px 10px; font-family:'Courier New',monospace; color:#000; font-size:20px; line-height:1.35; }
  .store { text-align:center; font-weight:800; font-size:26px; }
  .sub { text-align:center; font-size:16px; word-break:break-word; }
  .logo { display:block; margin:0 auto 4px; max-width:200px; max-height:120px; object-fit:contain; filter:grayscale(1) contrast(1.4); }
  .hr { border-top:2px dashed #000; margin:6px 0; }
  .row { display:flex; justify-content:space-between; gap:8px; }
  .row span:last-child { text-align:right; }
  .it { margin-bottom:4px; }
  .nm { font-weight:700; word-break:break-word; }
  .i { font-style:italic; }
  .b { font-weight:700; }
  .total { font-weight:800; font-size:24px; border-top:2px solid #000; border-bottom:2px solid #000; padding:2px 0; margin:2px 0; }
  .foot { text-align:center; font-size:16px; margin-top:6px; white-space:pre-wrap; }
  @media print { @page { size:58mm auto; margin:0; } body { width:58mm; } .receipt { width:58mm; padding:2mm; font-size:9pt; } .store { font-size:12pt; } .total { font-size:11pt; } }
`;

/** HTML dokumen lengkap untuk browser-print 58mm (window.open). */
export const buildThermalReceiptHTML = (
  snap: ReceiptSnapshot,
  status: 'TAGIHAN' | 'LUNAS',
): string =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk ${esc(snap.orderNumber || '')}</title>
  <style>${THERMAL_CSS}</style></head><body>${buildThermalReceiptBody(snap, status)}</body></html>`;
