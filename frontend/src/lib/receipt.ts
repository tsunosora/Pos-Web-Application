export interface ReceiptItem {
  name: string;
  sku: string;
  qty: number;
  price: number; // total line price
  pricePerUnit: number;
  pricingMode: string;
  note?: string;
  unitType?: string;
  widthCm?: number;
  heightCm?: number;
  areaM2?: number;
  customPrice?: number | null;
  pcs?: number;
}

export interface ReceiptSnapshot {
  transactionId?: number;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  taxAmount: number;
  shippingCost?: number;
  grandTotal: number;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  dueDate?: Date;
  downPayment?: number;
  status?: string;
  orderNumber?: string;
  checkoutNumber?: string;
  checkoutCashierName?: string;
  paidAt?: Date;
  cashierName?: string;
  employeeName?: string;
  logoUrl?: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  taxRate: number;
  timestamp: Date;
  // Per-branch overrides (kalau transaksi punya branchId & BranchSettings set)
  notaHeader?: string;
  notaFooter?: string;
  branchLabel?: string; // contoh: "[PST] Cabang Pusat" untuk ditampilkan di nota
  // Titip cetak ke cabang lain — tampilkan info pickup di nota.
  productionBranchLabel?: string; // "[PST] Cabang Pusat" — lokasi cetak & pickup
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const buildWhatsAppText = (snap: ReceiptSnapshot, status: 'TAGIHAN' | 'LUNAS', bankAccounts?: any[]) => {
  const pm = snap.paymentMethod === 'BANK_TRANSFER' ? 'Transfer Bank' : snap.paymentMethod;
  const dateStr = snap.timestamp.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  let paymentDets = '';
  if (snap.paymentMethod === 'BANK_TRANSFER' && bankAccounts && bankAccounts.length > 0) {
    paymentDets = '\nDetail Rekening:\n' + bankAccounts.map((b: any) => `- ${b.bankName}: ${b.accountNumber} a.n. ${b.accountOwner}`).join('\n');
  } else if (snap.paymentMethod === 'QRIS') {
    paymentDets = '\nMetode Pembayaran: QRIS\n(Silakan scan gambar QRIS yang kami lampirkan bersama pesan ini)';
  }

  const itemLines = snap.items.map(item => {
    let line = `- ${item.name}`;
    if (item.pricingMode === 'AREA_BASED') {
      const u = item.unitType || 'm';
      let dimStr = '';
      if (u === 'menit') dimStr = `${item.widthCm} menit`;
      else dimStr = `${item.widthCm}x${item.heightCm} ${u} = ${item.areaM2?.toLocaleString('id-ID')} unit`;
      line += `\n  Jml: ${item.qty} | Dimensi: ${dimStr}`;
      if (item.pcs && item.pcs > 1) line += `\n  PCS/Kopi: ×${item.pcs}`;
      line += `\n  Harga dasar: Rp ${item.pricePerUnit.toLocaleString('id-ID')}`;
    } else {
      line += `\n  Jml: ${item.qty} x Rp ${item.pricePerUnit.toLocaleString('id-ID')}`;
    }
    if (item.note) line += `\n  Catatan: ${item.note}`;
    line += `\n  Subtotal: Rp ${item.price.toLocaleString('id-ID')}`;
    return line;
  }).join('\n');

  const title = status === 'TAGIHAN' ? 'INVOICE TAGIHAN' : 'INVOICE PEMBAYARAN';

  return [
    `*${(snap.storeName || 'Toko').toUpperCase()}*`,
    snap.branchLabel ? `_${snap.branchLabel}_` : '',
    `*${title}*`,
    `Tanggal: ${dateStr}`,
    snap.customerName ? `Pelanggan: ${snap.customerName}${snap.customerPhone ? ` (${snap.customerPhone})` : ''}` : '',
    snap.customerAddress ? `Alamat: ${snap.customerAddress}` : '',
    snap.notaHeader ? `\n${snap.notaHeader}` : '',
    snap.productionBranchLabel ? `*Dicetak & diambil di: ${snap.productionBranchLabel}*` : '',
    ``,
    itemLines,
    ``,
    `----------------------`,
    `Subtotal   : Rp ${snap.subtotal.toLocaleString('id-ID')}`,
    snap.discount ? `Diskon      : -Rp ${snap.discount.toLocaleString('id-ID')}` : '',
    `Pajak ${(snap.taxRate).toFixed(2)}% : Rp ${snap.taxAmount.toLocaleString('id-ID')}`,
    snap.shippingCost ? `Ongkos Kirim: Rp ${snap.shippingCost.toLocaleString('id-ID')}` : '',
    `*TOTAL BAYAR: Rp ${snap.grandTotal.toLocaleString('id-ID')}*`,
    `----------------------`,
    `Pembayaran : ${pm}`,
    `Status     : *${status}*`,
    paymentDets,
    ``,
    snap.notaFooter || `Terima kasih!`,
  ].filter(Boolean).join('\n');
};

export const buildInvoiceHTML = (snap: ReceiptSnapshot, status: 'TAGIHAN' | 'LUNAS', bankAccounts?: any[]) => {
  const pm = snap.paymentMethod === 'BANK_TRANSFER' ? 'Transfer Bank' : snap.paymentMethod;
  const dateObj = snap.timestamp;
  const dateFormatted = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeFormatted = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const receiptNo = snap.orderNumber || (snap.transactionId ? 'S' + String(snap.transactionId).padStart(9, '0') : 'DRAFT-' + Math.floor(Math.random() * 1000));

  const terbilang = (angka: number): string => {
    const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    if (angka < 12) return bilangan[angka];
    if (angka < 20) return terbilang(angka - 10) + ' Belas';
    if (angka < 100) return terbilang(Math.floor(angka / 10)) + ' Puluh ' + (angka % 10 > 0 ? ' ' + terbilang(angka % 10) : '');
    if (angka < 200) return 'Seratus ' + (angka - 100 > 0 ? terbilang(angka - 100) : '');
    if (angka < 1000) return terbilang(Math.floor(angka / 100)) + ' Ratus ' + (angka % 100 > 0 ? terbilang(angka % 100) : '');
    if (angka < 2000) return 'Seribu ' + (angka - 1000 > 0 ? terbilang(angka - 1000) : '');
    if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + ' Ribu ' + (angka % 1000 > 0 ? terbilang(angka % 1000) : '');
    if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + ' Juta ' + (angka % 1000000 > 0 ? terbilang(angka % 1000000) : '');
    return '';
  };
  const terbilangStr = terbilang(snap.grandTotal).trim().toUpperCase() + ' RUPIAH';

  const rows = snap.items.map((item, i) => {
    const isArea = item.pricingMode === 'AREA_BASED';
    const u = item.unitType || 'm';
    let dimStr = '-';
    let unitTypeStr = 'PCS';

    if (isArea) {
      if (u === 'menit') {
        dimStr = `${item.widthCm}`;
        unitTypeStr = 'Mnt';
      } else {
        dimStr = `${item.widthCm}x${item.heightCm}`;
        unitTypeStr = u;
      }
    }

    const qtyStr = isArea ? `${item.pcs && item.pcs > 1 ? item.pcs : 1}` : `${item.qty}`;
    const noteStr = item.note ? `<br><span style="font-size:10px; color:#555;">${item.note}</span>` : '';

    const displayPrice = item.customPrice != null ? item.customPrice : item.pricePerUnit;
    const subtotalPrice = isArea
        ? item.price
        : (item.customPrice != null ? item.customPrice : item.pricePerUnit * item.qty);

    return `<tr style="border-bottom:1px solid #000;">
            <td style="padding:4px; text-align:right;">${i + 1}</td>
            <td style="padding:4px;">${item.sku || '-'}</td>
            <td style="padding:4px;">${item.name}${noteStr}</td>
            <td style="padding:4px; text-align:center;">${qtyStr}</td>
            <td style="padding:4px; text-align:center;">${dimStr}</td>
            <td style="padding:4px; text-align:center;">${unitTypeStr}</td>
            <td style="padding:4px; text-align:right;">${displayPrice.toLocaleString('id-ID')}</td>
            <td style="padding:4px; text-align:right;">0,00</td>
            <td style="padding:4px; text-align:right;">0</td>
            <td style="padding:4px; text-align:right;">${subtotalPrice.toLocaleString('id-ID')}</td>
        </tr>`;
  }).join('');

  const bankRows = (bankAccounts || []).map((b: any) => `${b.bankName} ${b.accountNumber} ${b.accountOwner}`).join(', ');

  // Footer: prioritas notaFooter (jika di-set per cabang / global). Kalau tidak, pakai default warning.
  const footerMessage = snap.notaFooter || 'Harap cek terlebih dahulu! Tidak menerima complain untuk barang yang sudah dibawa.';
  // Info pembayaran ditampilkan terpisah supaya notaFooter tidak dipaksa jadi "Pembayaran secara TUNAI".
  const paymentInfo = bankRows
    ? bankRows
    : (snap.paymentMethod === 'QRIS' ? 'Pembayaran via QRIS' : 'Pembayaran secara TUNAI');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Faktur Order - ${snap.storeName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: "Times New Roman", Times, serif; font-size:12px; color:#000; background:#fff; line-height:1.3; }
  .page { max-width:800px; margin:0 auto; padding:20px; }
  .header { display:flex; justify-content:space-between; margin-bottom:15px; }
  .logo-area { display:flex; align-items:center; }
  .store-title { font-size:24px; font-weight:bold; color:#d97706; margin-bottom:4px; font-family: Arial, sans-serif; }
  .store-address { font-size:11px; }
  .faktur-title { text-align:right; }
  .faktur-title h2 { font-size:16px; margin-bottom:10px; }
  .faktur-title p { font-size:11px; }
  
  .info-section { display:flex; justify-content:space-between; border-top:2px solid #000; border-bottom:1px solid #000; padding:8px 0; margin-bottom:10px; }
  .info-left { width:40%; }
  .info-right { width:55%; display:flex; justify-content:space-between; }
  
  table { width:100%; border-collapse:collapse; margin-bottom:15px; }
  th { border-top:1px solid #000; border-bottom:1px solid #000; padding:4px; font-size:11px; text-align:left; font-weight:normal; }
  td { font-size:11px; }
  
  .summary-section { display:flex; justify-content:space-between; margin-top:10px; border-bottom:1px solid #000; padding-bottom:15px; }
  .terbilang-box { width:50%; font-style:italic; font-size:11px; }
  .totals-box { width:45%; }
  .total-row { display:flex; justify-content:space-between; margin-bottom:2px; font-size:11px; }
  .total-label { display:flex; justify-content:space-between; width:150px; }
  
  .signatures { display:flex; margin-top:30px; margin-bottom:30px; font-size:11px; }
  .sig-box { width:150px; text-align:center; }
  .sig-space { height:60px; }
  
  .footer { font-size:10px; margin-top:20px; }
  @media print { body { background:#fff; } .page { padding:10px; max-width:100%; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div class="logo-area">
      ${snap.logoUrl
      ? `<img src="${API_BASE}${snap.logoUrl}" alt="Logo" style="width:50px; height:50px; object-fit:contain; border-radius:8px; margin-right:10px; display:inline-block;" />`
      : `<div style="width:50px; height:50px; background:#eee; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:10px; font-weight:bold; font-family:sans-serif; color:#555;">LOGO</div>`}
      <div>
        <div class="store-title">${snap.storeName}</div>
        ${snap.branchLabel ? `<div style="font-size:11px; font-weight:bold; color:#444; margin-bottom:2px;">${snap.branchLabel}</div>` : ''}
        <div class="store-address">${snap.storeAddress || 'Jl. Default Address, Kota'}<br>Tlp/Email : ${snap.storePhone || '-'}</div>
      </div>
    </div>
    <div class="faktur-title">
      <h2>Faktur Order${status === 'TAGIHAN' ? ' (TAGIHAN)' : ''}</h2>
      <p>Tgl. Cetak : ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
    </div>
  </div>
  ${snap.notaHeader ? `<div style="text-align:center; font-size:11px; font-style:italic; padding:6px 0; border-bottom:1px dashed #000; margin-bottom:10px; white-space:pre-wrap;">${snap.notaHeader.replace(/</g, '&lt;')}</div>` : ''}
  ${snap.productionBranchLabel ? `<div style="text-align:center; font-size:12px; font-weight:bold; color:#8a5a00; background:#fff7e6; border:1px dashed #d4a000; padding:5px 8px; border-radius:6px; margin-bottom:10px;">⚑ Dicetak &amp; diambil di: ${snap.productionBranchLabel}</div>` : ''}

  <div class="info-section">
    <div class="info-left">
      <strong>Kepada</strong><br>
      ${snap.customerName || 'Pelanggan Umum'} ${snap.customerPhone ? '|| ' + snap.customerPhone : ''}<br>
      ${snap.customerAddress || ''}
    </div>
    <div class="info-right">
      <table style="width:60%; margin:0; border:none;">
        <tr><td style="padding:2px 0;"><strong>No. Surat Order</strong></td><td style="padding:2px 0;">: ${receiptNo}</td></tr>
        ${snap.checkoutNumber ? `<tr><td style="padding:2px 0;"><strong>No. Surat Checkout</strong></td><td style="padding:2px 0;">: ${snap.checkoutNumber}</td></tr>` : ''}
        <tr><td style="padding:2px 0;">Tanggal Order</td><td style="padding:2px 0;">: ${dateFormatted} &nbsp;&nbsp; ${timeFormatted}</td></tr>
        ${snap.paidAt ? `<tr><td style="padding:2px 0;">Tanggal Checkout</td><td style="padding:2px 0;">: ${snap.paidAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} &nbsp;&nbsp; ${snap.paidAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td></tr>` : ''}
        <tr><td style="padding:2px 0;">Estimasi Selesai</td><td style="padding:2px 0;">: ${snap.dueDate ? new Date(snap.dueDate).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}</td></tr>
      </table>
      <table style="width:50%; margin:0; border:none;">
        <tr><td style="padding:2px 0;">Kasir Order</td><td style="padding:2px 0;">: ${snap.cashierName || snap.employeeName || '-'}</td></tr>
        ${snap.checkoutCashierName ? `<tr><td style="padding:2px 0;">Kasir Checkout</td><td style="padding:2px 0;">: ${snap.checkoutCashierName}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="text-align:right; width:30px;">No.</th>
      <th style="width:100px;">Item</th>
      <th>Nama Pesanan</th>
      <th style="text-align:center; width:40px;">Jml</th>
      <th style="text-align:center; width:80px;">Dimensi</th>
      <th style="text-align:center;">Satuan</th>
      <th style="text-align:right;">Harga</th>
      <th style="text-align:right;">Jasa Desain</th>
      <th style="text-align:right;">Lain2</th>
      <th style="text-align:right;">Subtotal</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="summary-section">
    <div class="terbilang-box">
      ${terbilangStr}
      
      <div class="signatures">
        <div class="sig-box">Petugas<div class="sig-space"></div></div>
        <div class="sig-box">Penerima<div class="sig-space"></div></div>
      </div>
    </div>
    <div class="totals-box">
      <div class="total-row"><div class="total-label"><span>Total Transaksi</span><span>:</span></div><span>${snap.subtotal.toLocaleString('id-ID')}</span></div>
      ${snap.discount ? `<div class="total-row"><div class="total-label"><span>Diskon</span><span>:</span></div><span style="color:#dc2626;">-${snap.discount.toLocaleString('id-ID')}</span></div>` : ''}
      <div class="total-row"><div class="total-label"><span>PPN</span><span>:</span></div><span style="width:50px; text-align:right;">${(snap.taxRate).toFixed(2)} %</span><span style="width:70px; text-align:right;">${snap.taxAmount.toLocaleString('id-ID')}</span></div>
      ${snap.shippingCost ? `<div class="total-row"><div class="total-label"><span>Ongkos Kirim</span><span>:</span></div><span>${snap.shippingCost.toLocaleString('id-ID')}</span></div>` : ''}
      <div class="total-row"><div class="total-label"><span>Grand Total</span><span>:</span></div><span>${snap.grandTotal.toLocaleString('id-ID')}</span></div>
      
      <br>
      <div class="total-row"><div class="total-label"><span>Uang Muka</span><span>:</span></div><span>${snap.downPayment !== undefined ? snap.downPayment.toLocaleString('id-ID') : snap.grandTotal.toLocaleString('id-ID')}</span></div>
      <div class="total-row"><div class="total-label"><span>Sisa/Kekurangan</span><span>:</span></div><span>${snap.status === 'PAID' ? '0' : (snap.downPayment !== undefined ? (snap.grandTotal - snap.downPayment).toLocaleString('id-ID') : '0')}</span></div>
    </div>
  </div>

  <div class="footer">
    <div style="white-space:pre-wrap;">${footerMessage.replace(/</g, '&lt;')}</div>
    <div style="margin-top:4px; font-size:10px; color:#555;">${paymentInfo}</div>
  </div>
</div>
</body></html>`;
};

export const handlePrintSnap = (snap: ReceiptSnapshot, status: 'TAGIHAN' | 'LUNAS' = 'LUNAS', bankAccounts?: any[]) => {
  const html = buildInvoiceHTML(snap, status, bankAccounts);
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) return;
  win.document.write(html); win.document.close(); win.focus(); win.print();
};

export const handleShareWA = (snap: ReceiptSnapshot, status: 'TAGIHAN' | 'LUNAS' = 'LUNAS', bankAccounts?: any[]) => {
  const text = buildWhatsAppText(snap, status, bankAccounts);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

export const mapTransactionToReceipt = (trx: any, settings: any, branchSettings?: any): ReceiptSnapshot => {
  // Branch settings override global settings kalau ada value-nya.
  // branchSettings bisa datang dari 2 sumber:
  //   1) trx.branch.branchSettings (kalau backend include)
  //   2) parameter eksplisit (mis. dari query /branch-settings/:id)
  // CompanyBranch relation name = `settings` (bukan `branchSettings`). Dukung keduanya untuk kompat.
  const bs = branchSettings ?? trx?.branch?.settings ?? trx?.branch?.branchSettings ?? null;
  const branchInfo = trx?.branch
    ? (trx.branch.code ? `[${trx.branch.code}] ${trx.branch.name}` : trx.branch.name)
    : undefined;
  // Titip cetak: kalau transaksi punya productionBranch berbeda, tampilkan di nota untuk info pickup.
  const prodBranch = trx?.productionBranch;
  const prodBranchInfo = prodBranch && prodBranch.id !== trx?.branch?.id
    ? (prodBranch.code ? `[${prodBranch.code}] ${prodBranch.name}` : prodBranch.name)
    : undefined;

  const pick = <T,>(branchVal: T | null | undefined, globalVal: T | undefined): T | undefined =>
    (branchVal !== null && branchVal !== undefined && branchVal !== '') ? branchVal : globalVal;
  return {
    transactionId: trx.id,
    items: trx.items?.map((item: any) => {
      const pricingMode = item.productVariant?.product?.pricingMode || 'UNIT';
      let u = item.unitType || 'm';
      let w = Number(item.widthCm || 0);
      let h = Number(item.heightCm || 1);
      let areaM2 = 0;
      if (u === 'm') areaM2 = w * h;
      else if (u === 'cm') areaM2 = (w * h) / 10000;
      else if (u === 'menit') areaM2 = w;

      // AREA_BASED: priceAtTime = harga per m², lineTotal = pricePerM2 × area × pcs
      // UNIT: priceAtTime = harga per unit, lineTotal = price × qty
      const pcs = Math.max(1, Number(item.pcs) || 1);
      const lineTotal = pricingMode === 'AREA_BASED'
          ? Number(item.priceAtTime) * areaM2 * pcs
          : Number(item.priceAtTime) * item.quantity;

      return {
        name: item.productVariant?.product?.name + (item.productVariant?.variantName ? ` — ${item.productVariant.variantName}` : ''),
        sku: item.productVariant?.sku || '',
        qty: item.quantity,
        price: lineTotal,
        pricePerUnit: Number(item.priceAtTime),
        pricingMode,
        unitType: item.unitType,
        widthCm: item.widthCm,
        heightCm: item.heightCm,
        note: item.note,
        pcs: pcs > 1 ? pcs : undefined,
        areaM2
      };
    }) || [],
    subtotal: Number(trx.totalAmount),
    discount: Number(trx.discount) > 0 ? Number(trx.discount) : undefined,
    taxAmount: Number(trx.tax),
    shippingCost: Number(trx.shippingCost) > 0 ? Number(trx.shippingCost) : undefined,
    grandTotal: Number(trx.grandTotal),
    paymentMethod: trx.paymentMethod,
    customerName: trx.customerName || undefined,
    customerPhone: trx.customerPhone || undefined,
    customerAddress: trx.customerAddress || undefined,
    dueDate: trx.dueDate ? new Date(trx.dueDate) : undefined,
    downPayment: Number(trx.downPayment),
    status: trx.status,
    orderNumber: trx.invoiceNumber || undefined,
    checkoutNumber: trx.checkoutNumber || undefined,
    checkoutCashierName: trx.checkoutCashierName || undefined,
    paidAt: trx.paidAt ? new Date(trx.paidAt) : undefined,
    cashierName: trx.cashierName || undefined,
    logoUrl: pick(bs?.logoUrl, settings?.logoImageUrl) || undefined,
    storeName: pick(bs?.storeName, settings?.storeName) || 'Toko',
    storeAddress: pick(bs?.storeAddress, settings?.storeAddress) || undefined,
    storePhone: pick(bs?.storePhone, settings?.storePhone) || undefined,
    taxRate: settings?.enableTax ? Number(settings.taxRate ?? 10) : 0,
    timestamp: new Date(trx.createdAt),
    notaHeader: bs?.notaHeader || undefined,
    notaFooter: bs?.notaFooter || undefined,
    branchLabel: branchInfo,
    productionBranchLabel: prodBranchInfo,
  };
};
