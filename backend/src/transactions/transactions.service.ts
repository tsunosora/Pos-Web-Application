import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, TransactionStatus, CashflowType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { DiscordService } from '../discord/discord.service';
import { BranchContext } from '../common/branch-context.decorator';
import { computeLedgerCost } from '../branch-ledger/ledger-cost.util';
import { branchWhere, assertBranchAccess } from '../common/branch-where.helper';
import { ProductsService } from '../products/products.service';
import { buildCompositeClickBatch } from './composite-click.util';
import { areaFactors, assertSaneArea, lineTotalOf, normalizeUnit, storedPriceMultiplier, storedUnit } from './area-unit.util';
import { assertValidEditInput, assertValidTransactionInput, satuBaris } from './transaction-input.util';
import { akhirHari, awalHari, ymdLokal } from '../common/utils/tanggal.util';
// Pemasukan otomatis lain (modal pusat, pelunasan titipan, pemasukan tambahan) juga tanpa
// userId — dulu ikut terhitung "Penjualan" di dasbor.
import { KATEGORI_PENJUALAN } from '../common/kategori-kas';

type EditItemData = {
    id?: number;           // unset = item baru
    newVariantId?: number; // variant produk baru (id=undefined)
    quantity?: number;
    pcs?: number;          // jumlah cetak (khusus AREA_BASED)
    widthCm?: number;
    heightCm?: number;
    unitType?: string;
    priceOverride?: number; // custom price override
    remove?: boolean;       // hapus item ini dari transaksi
};

type TransactionEditData = {
    items: EditItemData[];
    discount?: number;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    label?: string | null;
};

@Injectable()
export class TransactionsService {
    private readonly logger = new Logger(TransactionsService.name);
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
        private discord: DiscordService,
        private productsService: ProductsService,
    ) { }

    /** Rincian potongan platform untuk note cashflow, mis. " — Rincian: Fee admin: Rp 2.000, Voucher: Rp 1.000". */
    private formatFeeDetail(items?: { name?: string; amount: number | string }[] | null): string {
        if (!Array.isArray(items) || items.length === 0) return '';
        const parts = items
            .filter((f) => Number(f.amount) > 0)
            .map((f) => `${(f.name || '').toString().trim() || 'Potongan'}: Rp ${Number(f.amount).toLocaleString('id-ID')}`);
        return parts.length ? ` — Rincian: ${parts.join(', ')}` : '';
    }

    // Helper: buat StockMovement dengan balanceAfter otomatis dari stok variant saat ini (post-update)
    /** Kode cabang untuk prefix penomoran (SO-/SC-) — '' kalau cabang/kode kosong. */
    private async branchCodeFor(tx: any, branchId?: number | null): Promise<string> {
        if (branchId == null) return '';
        const b = await tx.companyBranch.findUnique({
            where: { id: branchId }, select: { code: true },
        });
        return ((b as any)?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    private async logMovement(tx: any, variantId: number, type: string, quantity: number, reason: string, referenceId?: string, branchId?: number | null) {
        const v = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } });
        await tx.stockMovement.create({
            data: {
                productVariantId: variantId,
                type,
                quantity,
                reason,
                balanceAfter: v ? Number(v.stock) : null,
                ...(referenceId ? { referenceId } : {}),
                ...(branchId != null ? { branchId } : {}),
            } as any,
        });
    }

    // Multi-cabang: pastikan BranchStock punya stok cukup untuk variant di cabang ini.
    // Dipakai sebelum decrement agar error message jelas per-cabang.
    private async _assertBranchStock(
        tx: any,
        branchId: number | null | undefined,
        variantId: number,
        needed: number,
        productName: string,
    ) {
        if (branchId == null) {
            // Tidak ada cabang context → fallback cek variant.stock global (kompat lama).
            return;
        }
        // Kunci baris stok sampai transaksi ini selesai (T-24): dua penjualan bersamaan
        // dulu sama-sama membaca stok lama lalu sama-sama lolos. Dengan FOR UPDATE yang
        // kedua menunggu, lalu membaca stok yang sudah dikurangi yang pertama.
        const rows: { stock: number | bigint }[] = await tx.$queryRaw`SELECT stock FROM branch_stocks WHERE branch_id = ${branchId} AND product_variant_id = ${variantId} FOR UPDATE`;
        const have = Number(rows[0]?.stock ?? 0);
        if (have < needed) {
            throw new BadRequestException(
                `Stok ${productName} di cabang ini tidak cukup. Tersedia: ${have}, dibutuhkan: ${needed}.`,
            );
        }
    }

    /**
     * Kunci baris nota sampai transaksi DB selesai. Tanpa ini dua permintaan bersamaan
     * (klik ganda "Lunasi", tambah DP + lunasi, edit + lunasi) sama-sama membaca angka
     * lama dan mencatat pemasukan dua kali.
     */
    private async lockTransactionRow(tx: any, id: number) {
        await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
    }

    /**
     * Nomor checkout (SC-…) dihitung "terakhir + 1": dua pelunasan bersamaan di cabang sama bisa
     * mendapat nomor yang sama → P2002. Transaksi DB-nya sudah dibatalkan penuh, jadi aman diulang
     * dengan nomor baru (dulu kasir melihat "duplikat" & nota tetap belum lunas).
     */
    private async ulangBilaBentrok<T>(kerja: () => Promise<T>): Promise<T> {
        for (let coba = 0; ; coba++) {
            try {
                return await kerja();
            } catch (e: any) {
                if (e?.code !== 'P2002' || coba >= 4) throw e;
            }
        }
    }

    /** Catat kunci checkout POS sebagai op sinkron (lihat controller create). Gagal = diamkan. */
    async catatKunciCheckout(kunci: string, txId: number | null, branchId: number | null) {
        await this.prisma.syncedOp.create({ data: { clientId: kunci, type: 'transaction.create', serverId: txId, branchId } }).catch(() => {});
    }

    /**
     * Aturan potong stok SAAT CHECKOUT (cermin _createTransaction) — dipakai edit & hapus nota
     * supaya yang dikembalikan / dipotong ulang persis sama dengan yang dulu dipotong:
     *  - AREA: stok varian + BOM hanya bila !requiresProduction && trackStock (produk produksi
     *    dipotong operator saat Mulai Job).
     *  - UNIT: stok varian bila trackStock; BOM SELALU (juga bila trackStock=false).
     *  - Sub order, item COMPOSITE & item custom (tanpa varian): tidak memotong apa pun.
     */
    private stockRulesOf(product: any, isSubOrder: boolean): { variant: boolean; bom: boolean } {
        if (!product || isSubOrder) return { variant: false, bom: false };
        const mode = product.pricingMode || 'UNIT';
        const track = product.trackStock !== false;
        if (mode === 'COMPOSITE') return { variant: false, bom: false };
        if (mode === 'AREA_BASED') {
            const ok = track && product.requiresProduction !== true;
            return { variant: ok, bom: ok };
        }
        return { variant: track, bom: true };
    }

    /**
     * Baris kas milik SATU nota. `note contains` saja tidak cukup: INV-…-100 juga cocok
     * dengan INV-…-1000, jadi pastikan nomor nota tidak diikuti angka lain.
     */
    private async cashflowsOfInvoice(tx: any, invoiceNumber: string, where: Record<string, unknown>) {
        const rows: any[] = await tx.cashflow.findMany({
            where: { ...where, note: { contains: invoiceNumber } },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
        });
        return rows.filter((r) => {
            const i = String(r.note || '').indexOf(invoiceNumber);
            return i >= 0 && !/[0-9]/.test(String(r.note).charAt(i + invoiceNumber.length));
        });
    }

    // Multi-cabang: ubah stok di BranchStock (delta bisa positif/negatif) DAN mirror ke
    // ProductVariant.stock sebagai cache agregat. Kalau branchId null → hanya update variant.stock (kompat lama).
    private async _adjustStock(
        tx: any,
        branchId: number | null | undefined,
        variantId: number,
        delta: number,
    ) {
        // Bulatkan ke 2 desimal untuk konsistensi dengan kode lama.
        const rounded = Math.floor(delta * 100) / 100;

        // Update cache global di ProductVariant.stock — increment atomik. Dulu baca-lalu-tulis
        // nilai absolut: dua penjualan bersamaan (walau beda cabang) → salah satu potongan hilang.
        await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: { increment: rounded } },
        });

        // Mirror ke BranchStock (per cabang)
        if (branchId != null) {
            await (tx as any).branchStock.upsert({
                where: {
                    branchId_productVariantId: { branchId, productVariantId: variantId },
                },
                update: { stock: { increment: rounded } },
                create: {
                    branchId,
                    productVariantId: variantId,
                    stock: rounded,
                },
            });
        }
    }

    async create(data: {
        items: {
            productVariantId?: number | null;
            customName?: string;
            quantity: number;
            widthCm?: number;
            heightCm?: number;
            unitType?: string;
            note?: string;
            customPrice?: number;
            isSubOrder?: boolean;
            subPrice?: number;
            subVendor?: string;
        }[];
        paymentMethod: PaymentMethod;
        discount?: number;
        shippingCost?: number;
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        label?: string;             // nama event/pekerjaan (dari SO / diisi kasir)
        marketplace?: string;       // platform marketplace (dari SO / dipilih kasir)
        marketplaceOrderNo?: string;
        dueDate?: string;
        downPayment?: number;
        cashierName?: string;
        employeeName?: string;
        bankAccountId?: number;
        productionPriority?: string;
        productionDeadline?: string;
        productionNotes?: string;
        transactionDate?: string; // ISO date backdate: "2026-03-29" — sets transaction createdAt
        cashflowDate?: string;    // ISO date for cashflow: jika diisi, cashflow.date = ini (hari ini = masuk shift hari ini)
        saveOnly?: boolean;       // true = simpan invoice tanpa pembayaran (PENDING)
        salesOrderId?: number;    // jika transaksi dibuat dari SO, tandai SO sebagai INVOICED setelah sukses
        branchId?: number | null; // cabang sumber transaksi (multi-cabang)
        branchName?: string;
        productionBranchId?: number | null; // titip cetak ke cabang lain (null = cetak di cabang sendiri)
        actorUserId?: number | null; // akun yang membuat nota (jejak harga manual, T-32)
    }) {
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                return await this._createTransaction(data);
            } catch (e: any) {
                // P2002 = unique constraint violation. Jika terjadi di invoice number (race condition), retry.
                if (e?.code === 'P2002' && attempt < 4) {
                    continue;
                }
                throw e;
            }
        }
        throw new BadRequestException('Gagal membuat transaksi setelah beberapa percobaan.');
    }

    private async _createTransaction(data: {
        items: {
            productVariantId?: number | null;
            customName?: string;
            quantity: number;
            widthCm?: number;
            heightCm?: number;
            unitType?: string;
            pcs?: number;
            note?: string;
            customPrice?: number;
            isSubOrder?: boolean;
            subPrice?: number;
            subVendor?: string;
        }[];
        paymentMethod: PaymentMethod;
        discount?: number;
        shippingCost?: number;
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        label?: string;             // nama event/pekerjaan (dari SO / diisi kasir)
        marketplace?: string;       // platform marketplace (dari SO / dipilih kasir)
        marketplaceOrderNo?: string;
        dueDate?: string;
        downPayment?: number;
        cashierName?: string;
        employeeName?: string;
        bankAccountId?: number;
        productionPriority?: string;
        productionDeadline?: string;
        productionNotes?: string;
        marketplaceFee?: number;
        marketplaceFeeItems?: { name: string; amount: number }[];
        transactionDate?: string;
        cashflowDate?: string;
        saveOnly?: boolean;
        salesOrderId?: number;
        branchName?: string;   // DEPRECATED — pakai branchId
        branchId?: number | null;  // cabang sumber (multi-cabang)
        productionBranchId?: number | null; // Titip cetak ke cabang lain. null = sama dengan branchId.
        actorUserId?: number | null;
    }) {
        assertValidTransactionInput(data);
        // Rekening tujuan (lunas / DP) harus milik cabang nota ini (atau rekening bersama) & aktif.
        for (const bid of [(data as any).bankAccountId, (data as any).dpBankAccountId]) {
            await this.cekRekeningNota(this.prisma, bid, (data as any).branchId ?? null);
        }
        const branchId = data.branchId ?? null;
        // Cabang yang mengeksekusi produksi (mesin cetak + stok bahan + antrian + click counter).
        // Kalau user kasir pilih "titip cetak ke Pusat", branchId (transaksi) = Bantul, productionBranchId = Pusat.
        // Default: null → pakai branchId (cetak di cabang sendiri).
        const productionBranchId: number | null = data.productionBranchId ?? branchId;

        // Validasi cabang titip cetak: harus cabang aktif & berbeda dari branchId (kalau sama, disanitasi null di tx.create).
        if (productionBranchId && productionBranchId !== branchId) {
            const prodBranch = await this.prisma.companyBranch.findUnique({
                where: { id: productionBranchId },
                select: { id: true, isActive: true, name: true },
            });
            if (!prodBranch) throw new BadRequestException('Cabang produksi tujuan tidak ditemukan');
            if (!prodBranch.isActive) throw new BadRequestException(`Cabang produksi "${prodBranch.name}" tidak aktif`);
        }

        return this.prisma.$transaction(async (tx) => {
            // SO hanya boleh jadi nota SEKALI (T-35). Diklaim atomik di awal: permintaan
            // bersamaan dari SO yang sama menunggu kunci baris lalu gagal di sini. SO yang
            // notanya sudah dihapus (INVOICED tanpa transactionId) boleh dijadikan nota lagi.
            if (data.salesOrderId) {
                const klaim = await (tx as any).salesOrder.updateMany({
                    where: {
                        id: data.salesOrderId,
                        OR: [{ status: { notIn: ['INVOICED', 'CANCELLED'] } }, { status: 'INVOICED', transactionId: null }],
                    },
                    data: { status: 'INVOICED', invoicedAt: new Date() },
                });
                if (klaim.count === 0) {
                    const so = await (tx as any).salesOrder.findUnique({
                        where: { id: data.salesOrderId },
                        select: { soNumber: true, status: true, transaction: { select: { invoiceNumber: true } } },
                    });
                    if (so?.status === 'CANCELLED') throw new BadRequestException(`SO ${so.soNumber} sudah dibatalkan — tidak bisa dijadikan nota.`);
                    if (so) throw new BadRequestException(`SO ${so.soNumber} sudah dijadikan nota ${so.transaction?.invoiceNumber ?? ''} — tidak bisa ditagih dua kali.`.replace('  ', ' '));
                }
            }

            const settings = await tx.storeSettings.findFirst();
            const enableTax = settings?.enableTax ?? true;
            const taxRate = settings?.taxRate ? Number(settings.taxRate) : 10;

            // Pre-generate invoice number SEBELUM items loop supaya bisa di-tag ke setiap StockMovement
            // sebagai referenceId. Tujuannya: laporan stok bisa render link ke nota terkait.
            const _effectiveDateForInvoice = data.transactionDate ? new Date(data.transactionDate + 'T00:00:00') : new Date();
            const _y = _effectiveDateForInvoice.getFullYear();
            const _m = String(_effectiveDateForInvoice.getMonth() + 1).padStart(2, '0');
            const _d = String(_effectiveDateForInvoice.getDate()).padStart(2, '0');
            const _dateStr = `${_y}${_m}${_d}`;
            // Kode cabang di nomor nota → tiap cabang punya urutan harian sendiri
            // (SO-{KODE}-{YYYYMMDD}-{NNNN}); tanpa cabang/kode → format lama.
            const _branchCode = await this.branchCodeFor(tx, branchId);
            const _prefix = _branchCode ? `SO-${_branchCode}-${_dateStr}-` : `SO-${_dateStr}-`;
            // Cek nomor terakhir dari TRANSACTION yang masih ada
            const _lastToday = await tx.transaction.findFirst({
                where: { invoiceNumber: { startsWith: _prefix } },
                orderBy: { invoiceNumber: 'desc' },
                select: { invoiceNumber: true },
            });
            // Cek juga nomor yang PERNAH dipakai dari StockMovement.referenceId (persist setelah delete).
            // Tujuan: hindari reuse nomor invoice yang sudah dihapus (kalau direuse, audit trail rusak
            // karena referenceId stock movement lama jadi salah resolve ke transaksi baru).
            const _refPrefix = `tx-${_prefix}`;
            const _lastFromMovement = await tx.stockMovement.findFirst({
                where: { referenceId: { startsWith: _refPrefix } },
                orderBy: { referenceId: 'desc' },
                select: { referenceId: true },
            });
            const _seqFromTx = _lastToday
                ? parseInt(_lastToday.invoiceNumber.slice(_prefix.length), 10)
                : 0;
            const _seqFromMv = _lastFromMovement?.referenceId
                ? parseInt(_lastFromMovement.referenceId.slice(_refPrefix.length), 10)
                : 0;
            const _nextSeq = Math.max(_seqFromTx, _seqFromMv) + 1;
            const preInvoiceNumber = `${_prefix}${_nextSeq.toString().padStart(4, '0')}`;
            const movementRef = `tx-${preInvoiceNumber}`;

            let subtotal = 0;
            const transactionItemsData: any[] = [];

            for (const item of data.items) {
                // Sub Order: item dicetak di printing luar. hppAtTime = harga sub (per m²/satuan)
                // supaya laporan profit otomatis menghitung laba = harga jual − harga sub.
                // Item sub TIDAK memotong stok bahan/tinta (guard di blok pengurangan stok di bawah).
                const isSubOrder = item.isSubOrder === true;
                const subPrice = isSubOrder ? Number(item.subPrice ?? 0) : null;
                const subVendor = isSubOrder ? (item.subVendor?.trim() || null) : null;

                // Item COMPOSITE (produk konfigurasi) — dicek DULU karena juga tak punya
                // productVariantId di payload. Harga & HPP dihitung ULANG di server
                // (jangan percaya harga dari client). Disimpan sebagai 1 baris nota yang
                // menunjuk VARIAN ANCHOR produk composite (agar tergrup di laporan per-produk)
                // dengan override priceAtTime & hppAtTime ke hasil hitung (HPP != 0).
                if ((item as any).compositeProductId) {
                    const compositeProductId = Number((item as any).compositeProductId);
                    // Lewatkan `tx`: tanpa itu computeComposite menarik koneksi BARU
                    // dari pool sementara transaksi ini masih memegang satu → pool
                    // (default 11) habis saat checkout paralel dan semua request
                    // lain kena "Timed out fetching a new connection".
                    const quote = await this.productsService.computeComposite(
                        compositeProductId,
                        (item as any).compositeOptions ?? {},
                        tx,
                    );
                    const qty = Math.max(1, Math.round(Number(item.quantity) || 1));

                    // Anchor variant = varian milik produk composite itu sendiri (grouping laporan).
                    // WAJIB ada & BOM-nya kosong (produk-shell), lihat rencana Keputusan #6.
                    const anchor = await (tx as any).productVariant.findFirst({
                        where: { productId: compositeProductId },
                        orderBy: { id: 'asc' },
                        select: { id: true },
                    });
                    if (!anchor) throw new BadRequestException(`Produk konfigurasi ${compositeProductId} belum punya varian anchor`);

                    // Klik mesin komponen (isi/cover A3+). Dulu sengaja tidak diemit
                    // ("Fase 1") → lembar yang dipakai buku tidak pernah masuk laporan
                    // klik & notanya tak muncul di papan Cetak. Harga & HPP TIDAK
                    // tersentuh: ini hanya pencatatan klik + antrian cetak.
                    const compVariantIds = [
                        ...new Set(((quote.breakdown ?? []) as any[])
                            .map((b: any) => Number(b?.variantId))
                            .filter((n: number) => Number.isFinite(n) && n > 0)),
                    ];
                    const compVariants = compVariantIds.length
                        ? await (tx as any).productVariant.findMany({
                            where: { id: { in: compVariantIds } },
                            select: {
                                id: true, clicksPerUnit: true,
                                clickRate: { select: { id: true, isActive: true, pricePerClick: true } },
                                product: {
                                    select: {
                                        clicksPerUnit: true,
                                        clickRate: { select: { id: true, isActive: true, pricePerClick: true } },
                                    },
                                },
                            },
                        })
                        : [];
                    const compositeClickBatch = buildCompositeClickBatch(
                        (quote.breakdown ?? []) as any[],
                        compVariants as any[],
                        qty,
                    );

                    transactionItemsData.push({
                        productVariantId: anchor.id,   // BUKAN null → tergrup di laporan per-produk
                        customName: quote.name,        // nama deskriptif untuk nota
                        quantity: qty,
                        priceAtTime: quote.price,      // per 1 unit composite (dari server)
                        hppAtTime: quote.hpp,          // WAJIB hasil hitung, JANGAN 0 (modal akurat)
                        isSubOrder,
                        subPrice: isSubOrder ? subPrice : null,
                        subVendor,
                        note: JSON.stringify({
                            kind: 'composite',
                            productId: compositeProductId,
                            selectedOptions: (item as any).compositeOptions ?? {},
                            breakdown: quote.breakdown,
                            userNote: item.note ?? null,
                        }),
                        _requiresProduction: true,     // spawn 1 ProductionJob (buku harus dikerjakan)
                        _clickRateId: null,            // klik komposit dicatat lewat _clickBatch (bisa >1 tarif)
                        _clickQuantity: 0,
                        _clickPricePerClick: 0,
                        _clickBatch: compositeClickBatch,
                    });
                    subtotal += quote.price * qty;
                    continue;
                }

                // Item custom (tanpa varian katalog) — mis. dari CRM lead dengan item bebas.
                // Tidak ada lookup stok, tidak ada BOM, langsung masuk produksi.
                if (!item.productVariantId) {
                    const qty = item.quantity || 1;
                    const customPrice = item.customPrice ?? 0;
                    transactionItemsData.push({
                        productVariantId: null,
                        customName: item.customName || null,
                        quantity: qty,
                        priceAtTime: customPrice,
                        hppAtTime: isSubOrder ? (subPrice ?? 0) : 0,
                        isSubOrder,
                        subPrice: isSubOrder ? subPrice : null,
                        subVendor,
                        note: item.note || null,
                        _requiresProduction: true,
                        _clickRateId: null,
                        _clickQuantity: 0,
                        _clickPricePerClick: 0,
                    });
                    subtotal += customPrice * qty;
                    continue;
                }

                const variant = await (tx as any).productVariant.findUnique({
                    where: { id: item.productVariantId },
                    include: {
                        product: { include: { ingredients: true, clickRate: true } },
                        priceTiers: { orderBy: { minQty: 'asc' } },
                        variantIngredients: true,
                        clickRate: true,
                    }
                });

                if (!variant) throw new NotFoundException(`Variant ID ${item.productVariantId} not found`);

                const pricingMode = (variant.product as any).pricingMode || 'UNIT';
                let lineTotal = 0;
                let widthCm: number | null = null;
                let heightCm: number | null = null;
                let areaCm2: number | null = null;

                const requiresProduction = (variant.product as any).requiresProduction === true;
                const trackStock = (variant.product as any).trackStock !== false;

                // Resolve tier price for UNIT mode
                const priceTiers: any[] = (variant as any).priceTiers || [];
                let resolvedPrice = Number(variant.price);
                if (pricingMode === 'UNIT' && priceTiers.length > 0) {
                    // Tier paling spesifik (minQty terbesar yang cocok) — sama dengan layar POS. Dulu server
                    // memilih yang terkecil: tier "min 10" & "min 50" tanpa batas atas → qty 60 layar Rp 7.000, nota Rp 8.000.
                    const matchedTier = [...priceTiers].sort((a: any, b: any) => b.minQty - a.minQty).find((t: any) =>
                        item.quantity >= t.minQty && (t.maxQty === null || item.quantity <= t.maxQty)
                    );
                    if (matchedTier) resolvedPrice = Number(matchedTier.price);
                }
                // Admin custom price override for UNIT mode — harga normal dicatat (T-32).
                let hargaNormal: number | null = null;
                if (pricingMode === 'UNIT' && item.customPrice != null) {
                    if (Math.abs(Number(item.customPrice) - resolvedPrice) > 0.005) hargaNormal = resolvedPrice;
                    resolvedPrice = item.customPrice;
                }

                // Calculate HPP from variant ingredients if defined; fallback to variant.hpp
                const variantIngredients: any[] = (variant as any).variantIngredients || [];
                let resolvedHpp = Number(variant.hpp);
                if (variantIngredients.length > 0) {
                    resolvedHpp = variantIngredients.reduce((sum: number, ing: any) => {
                        return sum + Number(ing.price) * Number(ing.quantity);
                    }, 0);
                }

                if (pricingMode === 'AREA_BASED') {
                    // Area-based calculation depending on unitType.
                    // Kalau tidak ada dimensi tapi customPrice di-set (mis. dari CRM lead convert),
                    // pakai customPrice sebagai total harga langsung — skip kalkulasi area.
                    if (item.widthCm == null && item.customPrice == null) {
                        throw new BadRequestException(`Nilai / Dimensi cetak wajib diisi untuk produk area: ${variant.product.name}`);
                    }
                    widthCm = item.widthCm ?? null;
                    heightCm = item.heightCm || 1;

                    // priceMultiplier: raw area in input unit (for price calculation)
                    // areaM2: always in m² (for stock deduction & movement logging)
                    // Satuan kosong/tak dikenal = 'cm' — SAMA untuk menghitung & menyimpan (T-08).
                    const areaUnit = normalizeUnit(item.unitType);
                    let priceMultiplier = 0;
                    let areaM2 = 0;
                    // Kalau widthCm null (dari CRM convert tanpa dimensi), skip kalkulasi area —
                    // customPrice akan override lineTotal di bawah.
                    if (widthCm != null) {
                        ({ priceMultiplier, areaM2 } = areaFactors(areaUnit, widthCm, heightCm));
                        assertSaneArea(areaUnit, widthCm, heightCm, areaM2, variant.product.name);
                    }

                    areaCm2 = areaM2 * 10000;

                    // PCS/kopi — berapa kali dimensi ini dicetak
                    const pcs = Math.max(1, Math.round(Number(item.pcs) || 1));
                    const totalAreaM2 = areaM2 * pcs; // total area untuk stock & BOM

                    lineTotal = priceMultiplier * resolvedPrice * pcs;
                    // Admin custom price override for AREA_BASED mode (overrides full line total)
                    let areaPriceAtTime = resolvedPrice; // per-m² yang disimpan ke priceAtTime
                    if (item.customPrice != null) {
                        lineTotal = item.customPrice;
                        // Turunkan per-m² efektif dari customPrice supaya nota
                        // (priceAtTime × area × pcs) menjumlah TEPAT ke total tertagih
                        // (mis. harga nego dari CRM lead / override admin). Tanpa ini
                        // priceAtTime tetap harga katalog → baris nota tak = grandTotal.
                        // Dibagi PENGALI HARGA (bukan luas m²) supaya benar juga utk produk per cm².
                        if (priceMultiplier > 0 && pcs > 0) areaPriceAtTime = item.customPrice / (priceMultiplier * pcs);
                    }

                    if (!requiresProduction && trackStock && !isSubOrder) {
                        // Multi-cabang: stok DIKURANGI dari cabang PELAKSANA (productionBranchId).
                        // Kalau bukan titipan, productionBranchId = branchId (fallback di atas), jadi tetap sama.
                        // Sub Order → blok ini di-skip: tidak potong stok/BOM/tinta sama sekali.
                        const stockBranchId = productionBranchId ?? branchId;
                        await this._assertBranchStock(tx, stockBranchId, variant.id, totalAreaM2, variant.product.name);
                        await this._adjustStock(tx, stockBranchId, variant.id, -totalAreaM2);
                        await this.logMovement(tx, variant.id, 'OUT', totalAreaM2, `Penjualan Cetak ${widthCm}×${heightCm}${areaUnit === 'cm2' ? 'cm' : areaUnit} ×${pcs}pcs (${totalAreaM2.toFixed(2)}m²) — ${preInvoiceNumber}`, movementRef, stockBranchId);

                        // Deduct product-level BOM (AREA_BASED)
                        const ingredients = (variant.product as any).ingredients || [];
                        for (const ing of ingredients) {
                            if (ing.rawMaterialVariantId) {
                                const neededStock = Number(ing.quantity) * totalAreaM2;
                                await this._adjustStock(tx, stockBranchId, ing.rawMaterialVariantId, -neededStock);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', neededStock, `Terpotong oleh Penjualan ${variant.product.name} — ${preInvoiceNumber}`, movementRef, stockBranchId);
                            }
                        }

                        // Deduct variant-level ingredients (AREA_BASED, non-service-cost only)
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const neededStock = Number(ing.quantity) * totalAreaM2;
                                await this._adjustStock(tx, stockBranchId, ing.rawMaterialVariantId, -neededStock);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', neededStock, `Terpotong (varian) oleh Penjualan ${variant.product.name} — ${preInvoiceNumber}`, movementRef, stockBranchId);
                            }
                        }
                    }

                    // Click log data for AREA_BASED — variant-level takes priority over product-level
                    const _areaClickRate = (variant as any).clickRate ?? (variant.product as any).clickRate;
                    const _areaClicksPerUnit = (variant as any).clicksPerUnit ?? (variant.product as any).clicksPerUnit ?? 1;
                    transactionItemsData.push({
                        productVariantId: variant.id,
                        quantity: 1,
                        priceAtTime: areaPriceAtTime,  // per-m² price (total derived from priceAtTime × area × pcs)
                        hppAtTime: isSubOrder ? (subPrice ?? 0) : resolvedHpp,
                        isSubOrder,
                        subPrice: isSubOrder ? subPrice : null,
                        subVendor,
                        widthCm,
                        heightCm,
                        areaCm2,
                        pcs,
                        unitType: areaUnit,
                        // Jejak harga manual (T-32): harga normal per m²/cm² & siapa pengubahnya.
                        originalPrice: item.customPrice != null && Math.abs(areaPriceAtTime - resolvedPrice) > 0.005 ? resolvedPrice : null,
                        priceOverrideById: item.customPrice != null && Math.abs(areaPriceAtTime - resolvedPrice) > 0.005 ? (data.actorUserId ?? null) : null,
                        note: item.note || null,
                        _requiresProduction: requiresProduction,
                        _clickRateId: _areaClickRate?.isActive ? _areaClickRate.id : null,
                        _clickQuantity: _areaClickRate?.isActive ? Math.max(1, Math.round(pcs * _areaClicksPerUnit)) : 0,
                        _clickPricePerClick: _areaClickRate ? Number(_areaClickRate.pricePerClick) : 0,
                    });

                } else {
                    // Standard UNIT mode
                    // Multi-cabang: stok dari cabang PELAKSANA (kalau titip cetak, dari cabang tujuan).
                    // Hoist ke luar `if (trackStock)` supaya bisa dipakai juga oleh BOM/ingredient deduction di bawah.
                    const stockBranchId = productionBranchId ?? branchId;
                    if (trackStock && !isSubOrder) {
                        await this._assertBranchStock(tx, stockBranchId, variant.id, item.quantity, variant.product.name);
                        await this._adjustStock(tx, stockBranchId, variant.id, -item.quantity);
                        await this.logMovement(tx, variant.id, 'OUT', item.quantity, `Penjualan ${variant.product.name} — ${preInvoiceNumber}`, movementRef, stockBranchId);
                    }

                    lineTotal = resolvedPrice * item.quantity;
                    // Click log data for UNIT — variant-level takes priority over product-level
                    const _unitClickRate = (variant as any).clickRate ?? (variant.product as any).clickRate;
                    const _unitClicksPerUnit = (variant as any).clicksPerUnit ?? (variant.product as any).clicksPerUnit ?? 1;
                    transactionItemsData.push({
                        productVariantId: variant.id,
                        quantity: item.quantity,
                        priceAtTime: resolvedPrice,
                        originalPrice: hargaNormal,
                        priceOverrideById: hargaNormal != null ? (data.actorUserId ?? null) : null,
                        hppAtTime: isSubOrder ? (subPrice ?? 0) : resolvedHpp,
                        isSubOrder,
                        subPrice: isSubOrder ? subPrice : null,
                        subVendor,
                        note: item.note || null,
                        _requiresProduction: requiresProduction,
                        _clickRateId: _unitClickRate?.isActive ? _unitClickRate.id : null,
                        _clickQuantity: _unitClickRate?.isActive ? Math.max(1, Math.round(item.quantity * _unitClicksPerUnit)) : 0,
                        _clickPricePerClick: _unitClickRate ? Number(_unitClickRate.pricePerClick) : 0,
                    });

                    // Deduct product-level BOM (UNIT) — di cabang PELAKSANA (sama dengan stok variant utama)
                    const ingredients = (variant.product as any).ingredients || [];
                    for (const ing of ingredients) {
                        if (ing.rawMaterialVariantId && !isSubOrder) {
                            const neededStock = Number(ing.quantity) * item.quantity;
                            await this._adjustStock(tx, stockBranchId, ing.rawMaterialVariantId, -neededStock);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', neededStock, `Terpotong oleh Penjualan ${variant.product.name} — ${preInvoiceNumber}`, movementRef, stockBranchId);
                        }
                    }

                    // Deduct variant-level ingredients (UNIT, non-service-cost only) — di cabang PELAKSANA
                    // Sub Order → skip (tidak potong bahan/tinta).
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost && !isSubOrder) {
                            const neededStock = Number(ing.quantity) * item.quantity;
                            await this._adjustStock(tx, stockBranchId, ing.rawMaterialVariantId, -neededStock);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', neededStock, `Terpotong (varian) oleh Penjualan ${variant.product.name} — ${preInvoiceNumber}`, movementRef, stockBranchId);
                        }
                    }
                }

                subtotal += lineTotal;
            }

            // Rupiah tidak punya sen: harga per m² × luas bisa pecahan (853,05) → dibulatkan
            // di sini supaya kas & tutup shift bisa pas (T-20).
            subtotal = Math.round(subtotal);
            const discountAmount = Math.round(data.discount || 0);
            if (discountAmount > subtotal) {
                throw new BadRequestException(`Diskon Rp ${discountAmount.toLocaleString('id-ID')} melebihi subtotal Rp ${subtotal.toLocaleString('id-ID')} — nota tidak boleh bernilai minus.`);
            }
            const amountAfterDiscount = subtotal - discountAmount;

            let taxAmount = 0;
            if (enableTax) {
                taxAmount = Math.round(amountAfterDiscount * (taxRate / 100));
            }

            const shippingCost = Math.round(data.shippingCost || 0);
            const grandTotal = amountAfterDiscount + taxAmount + shippingCost;

            // Fee marketplace — hitung di sini supaya tersedia saat tx.create & cashflow
            const feeItems = (data.marketplaceFeeItems && data.marketplaceFeeItems.length > 0)
                ? data.marketplaceFeeItems
                : [];
            const marketplaceFee = feeItems.length > 0
                ? feeItems.reduce((s, f) => s + (Number(f.amount) || 0), 0)
                : (data.marketplaceFee || 0);
            if (marketplaceFee > grandTotal) {
                throw new BadRequestException(`Potongan marketplace Rp ${marketplaceFee.toLocaleString('id-ID')} melebihi nilai nota Rp ${grandTotal.toLocaleString('id-ID')}.`);
            }

            const isPayLater = data.saveOnly === true;
            // saveOnly + DP > 0 → status PARTIAL (terima uang muka saat simpan invoice)
            // DP tidak boleh melebihi total (T-12). Toleransi Rp 1 untuk pembulatan di layar kasir.
            if (data.downPayment != null && Number(data.downPayment) > grandTotal + 1) {
                throw new BadRequestException(`DP Rp ${Number(data.downPayment).toLocaleString('id-ID')} melebihi total Rp ${grandTotal.toLocaleString('id-ID')}. Kelebihan bayar = kembalian, bukan DP.`);
            }
            const dpMasuk = data.downPayment != null ? Math.min(Math.round(Number(data.downPayment)), grandTotal) : undefined;
            const downPayment = isPayLater
                ? (dpMasuk != null && dpMasuk > 0 ? dpMasuk : 0)
                : (dpMasuk !== undefined ? dpMasuk : grandTotal);
            const status = isPayLater && downPayment === 0
                ? TransactionStatus.PENDING
                : downPayment >= grandTotal
                    ? TransactionStatus.PAID
                    : TransactionStatus.PARTIAL;

            // ── Backdate support ──────────────────────────────────────────────
            // effectiveDate = tanggal nota (backdate atau hari ini)
            const effectiveDate = data.transactionDate ? new Date(data.transactionDate + 'T00:00:00') : new Date();
            // effectiveCashflowDate = tanggal cashflow (bisa hari ini jika user minta masuk shift hari ini)
            const effectiveCashflowDate = data.cashflowDate ? new Date(data.cashflowDate + 'T00:00:00') : effectiveDate;
            // Nota mundur tanggal TANPA centang "masuk shift hari ini": layar kasir menjanjikan
            // "Pendapatan masuk ke tanggal tersebut" — jangan ikut ekspektasi kas shift yang sedang
            // berjalan (uangnya sudah masuk laporan shift hari itu).
            const diluarShift = !!data.transactionDate && !data.cashflowDate && data.transactionDate !== ymdLokal();

            // Invoice number sudah di-pre-generate di atas (preInvoiceNumber) supaya bisa di-tag
            // ke StockMovement.referenceId. Pakai variable yang sama di sini.
            const dateStr = _dateStr;
            const invoiceNumber = preInvoiceNumber;

            // Generate SC number jika transaksi langsung PAID (bayar lunas di kasir)
            let checkoutNumber: string | null = null;
            if (status === TransactionStatus.PAID) {
                const scPrefix = _branchCode ? `SC-${_branchCode}-${dateStr}-` : `SC-${dateStr}-`;
                const lastSC = await tx.transaction.findFirst({
                    where: { checkoutNumber: { startsWith: scPrefix } },
                    orderBy: { checkoutNumber: 'desc' },
                    select: { checkoutNumber: true },
                });
                const nextSCSeq = lastSC ? parseInt(lastSC.checkoutNumber!.slice(scPrefix.length), 10) + 1 : 1;
                checkoutNumber = `${scPrefix}${nextSCSeq.toString().padStart(4, '0')}`;
            }

            // Strip internal flags before creating items
            const itemsForCreate = transactionItemsData.map(({ _requiresProduction, _clickRateId, _clickQuantity, _clickPricePerClick, _clickBatch, ...rest }: any) => rest);

            const transaction = await tx.transaction.create({
                data: {
                    invoiceNumber,
                    totalAmount: subtotal,
                    discount: discountAmount,
                    shippingCost: shippingCost,
                    marketplaceFee: marketplaceFee,
                    marketplaceFeeItems: feeItems.length > 0 ? feeItems : undefined,
                    tax: taxAmount,
                    grandTotal,
                    paymentMethod: data.paymentMethod,
                    status: status,
                    // Nama/HP satu baris: baris baru di nama bisa menyusupkan "LUNAS" palsu ke pesan WA (T-26).
                    customerName: satuBaris(data.customerName, 150),
                    customerPhone: satuBaris(data.customerPhone, 30),
                    customerAddress: data.customerAddress || null,
                    label: (data.label || '').replace(/\s+/g, ' ').trim().slice(0, 120) || null,
                    marketplace: (data.marketplace || '').replace(/\s+/g, ' ').trim().slice(0, 40) || null,
                    marketplaceOrderNo: (data.marketplace || '').trim() ? ((data.marketplaceOrderNo || '').trim().slice(0, 60) || null) : null,
                    dueDate: data.dueDate ? new Date(data.dueDate) : null,
                    downPayment: downPayment,
                    cashierName: data.cashierName || null,
                    employeeName: data.employeeName || null,
                    bankAccountId: data.bankAccountId || null,
                    dpPaymentMethod: status === TransactionStatus.PARTIAL && downPayment > 0 ? data.paymentMethod : null,
                    dpBankAccountId: status === TransactionStatus.PARTIAL && downPayment > 0 ? (data.bankAccountId || null) : null,
                    checkoutNumber: checkoutNumber,
                    paidAt: status === TransactionStatus.PAID ? effectiveDate : null,
                    checkoutCashierName: status === TransactionStatus.PAID ? (data.cashierName || null) : null,
                    productionPriority: data.productionPriority || 'NORMAL',
                    productionDeadline: data.productionDeadline ? new Date(data.productionDeadline) : null,
                    productionNotes: data.productionNotes || null,
                    branchName: data.branchName || null,
                    branchId: branchId,
                    // Simpan productionBranchId HANYA kalau berbeda dari branchId (titip cetak).
                    // Kalau sama dengan branchId (cetak di cabang sendiri), biarkan null supaya lebih bersih.
                    ...(productionBranchId && productionBranchId !== branchId
                        ? { productionBranchId }
                        : { productionBranchId: null }),
                    createdAt: effectiveDate,  // backdate support
                    items: { create: itemsForCreate }
                },
                include: { items: true, bankAccount: true, branch: { include: { settings: true } }, productionBranch: { include: { settings: true } } }
            } as any);

            // Create ProductionJob for items that require production
            const hasProductionItems = transactionItemsData.some((d: any) => d._requiresProduction);
            const jobDateStr = ymdLokal().replace(/-/g, ''); // tanggal WIB (dulu UTC)
            const jobPrefix = `JOB-${jobDateStr}-`;
            let jobSeq = 0;
            if (hasProductionItems) {
                const lastJob = await (tx as any).productionJob.findFirst({
                    where: { jobNumber: { startsWith: jobPrefix } },
                    orderBy: { jobNumber: 'desc' },
                    select: { jobNumber: true },
                });
                jobSeq = lastJob ? parseInt(lastJob.jobNumber.slice(jobPrefix.length), 10) : 0;
            }
            for (let i = 0; i < transactionItemsData.length; i++) {
                if (transactionItemsData[i]._requiresProduction) {
                    jobSeq++;
                    const txItem = (transaction as any).items[i];
                    await (tx as any).productionJob.create({
                        data: {
                            jobNumber: `${jobPrefix}${String(jobSeq).padStart(4, '0')}`,
                            transactionId: transaction.id,
                            transactionItemId: txItem.id,
                            // Routing titip cetak: job jalan di cabang produksi, bukan cabang transaksi.
                            branchId: productionBranchId,
                            status: 'ANTRIAN',
                            priority: data.productionPriority || 'NORMAL',
                            deadline: data.productionDeadline ? new Date(data.productionDeadline) : null,
                            notes: data.productionNotes || null,
                            // Sub Order: job disub ke printing luar → operator startJob tidak potong bahan.
                            isSubOrder: transactionItemsData[i].isSubOrder === true,
                        },
                    });
                }
            }

            // Auto-create ClickLogs + PrintJobs for items linked to a ClickRate (paper print)
            // Sequential counter for PRT job numbers within this transaction
            const todayStr = `${effectiveDate.getFullYear()}${String(effectiveDate.getMonth() + 1).padStart(2, '0')}${String(effectiveDate.getDate()).padStart(2, '0')}`;
            const prtPrefix = `PRT-${todayStr}-`;
            const lastPrt = await (tx as any).printJob.findFirst({
                where: { jobNumber: { startsWith: prtPrefix } },
                orderBy: { jobNumber: 'desc' },
                select: { jobNumber: true },
            });
            let prtSeq = 1;
            if (lastPrt?.jobNumber) {
                const n = parseInt(lastPrt.jobNumber.slice(prtPrefix.length), 10);
                if (!Number.isNaN(n)) prtSeq = n + 1;
            }

            for (let i = 0; i < transactionItemsData.length; i++) {
                const d = transactionItemsData[i] as any;
                // Item biasa: satu tarif klik. Item COMPOSITE (mis. Buku Custom):
                // bisa lebih dari satu tarif — isi (2 sisi) + cover (1 sisi).
                const clickEntries: { rateId: number; clicks: number; pricePerClick: number; label: string | null }[] =
                    Array.isArray(d._clickBatch) && d._clickBatch.length
                        ? d._clickBatch
                        : d._clickRateId && d._clickQuantity > 0 && d._clickPricePerClick > 0
                            ? [{ rateId: d._clickRateId, clicks: d._clickQuantity, pricePerClick: d._clickPricePerClick, label: null }]
                            : [];
                if (!clickEntries.length) continue;

                const txItem = (transaction as any).items[i];
                for (const e of clickEntries) {
                    await (tx as any).clickLog.create({
                        data: {
                            clickRateId: e.rateId,
                            transactionItemId: txItem.id,
                            quantity: e.clicks,
                            pricePerClick: e.pricePerClick,
                            totalCost: e.pricePerClick * e.clicks,
                            date: effectiveDate,
                            // Click counter mengikuti cabang produksi (mesin fisik ada di sana).
                            branchId: productionBranchId,
                        },
                    });
                }

                // Auto-create PrintJob for paper print tracking.
                // transaction_item_id UNIK di print_jobs → tetap SATU antrian cetak per
                // baris nota; untuk komposit jumlahnya = total lembar semua komponen.
                const dariKomposit = Array.isArray(d._clickBatch) && d._clickBatch.length > 0;
                const totalKlik = clickEntries.reduce((sum, e) => sum + e.clicks, 0);
                const rincianKlik = clickEntries.map((e) => e.label).filter(Boolean).join(' + ') || null;
                const jobNumber = `${prtPrefix}${String(prtSeq).padStart(4, '0')}`;
                prtSeq += 1;
                await (tx as any).printJob.create({
                    data: {
                        jobNumber,
                        transactionId: transaction.id,
                        transactionItemId: txItem.id,
                        // Antrian print jalan di cabang produksi, bukan cabang kasir.
                        branchId: productionBranchId,
                        quantity: dariKomposit ? totalKlik : txItem.quantity,
                        status: 'ANTRIAN',
                        notes: dariKomposit
                            ? [d.customName, rincianKlik].filter(Boolean).join(' — ') || null
                            : d.note || null,
                    },
                });
            }

            // Ambil branchName dari SO jika belum di-set manual
            let effectiveBranchName = data.branchName || null;
            if (!effectiveBranchName && data.salesOrderId) {
                try {
                    const soForBranch = await (tx as any).salesOrder.findUnique({
                        where: { id: data.salesOrderId },
                        select: { branchName: true },
                    });
                    effectiveBranchName = soForBranch?.branchName || null;
                } catch (_) { /* abaikan */ }
            }

            // Patch branchName ke transaction jika baru diketahui sekarang
            if (effectiveBranchName && !data.branchName) {
                await tx.transaction.update({
                    where: { id: transaction.id },
                    data: { branchName: effectiveBranchName } as any,
                });
            }

            // Log initial payment into Cashflow — skip only for pure PENDING (bayar nanti tanpa DP)
            const customerInfo = data.customerName ? ` untuk Bpk/Ibu ${data.customerName}` : '';
            const branchInfo = effectiveBranchName ? ` [${effectiveBranchName}]` : '';
            if (downPayment > 0) {
                // Income = GROSS (jumlah dibayar penuh). Potongan platform dicatat
                // SEKALI sebagai expense "Biaya Platform" di bawah — saldo turun
                // tepat 1× fee, omzet kotor akurat (hindari dobel-hitung fee).
                const isLunas = status === TransactionStatus.PAID;
                const incomeAmount = downPayment;
                await tx.cashflow.create({
                    data: {
                        type: CashflowType.INCOME,
                        category: status === TransactionStatus.PARTIAL ? 'Pembayaran DP' : 'Penjualan Lunas',
                        amount: incomeAmount,
                        paymentMethod: data.paymentMethod,
                        bankAccountId: data.bankAccountId || null,
                        note: `Pembayaran Invoice ${invoiceNumber}${customerInfo}${branchInfo} via ${data.paymentMethod}`,
                        branchName: effectiveBranchName,
                        branchId: branchId,
                        date: effectiveCashflowDate,
                        ...(diluarShift ? { excludeFromShift: true } : {}),
                    } as any
                });
                // Catat potongan marketplace sebagai expense (hanya saat lunas)
                if (isLunas && marketplaceFee > 0) {
                    const feeDetail = this.formatFeeDetail(feeItems);
                    await tx.cashflow.create({
                        data: {
                            type: CashflowType.EXPENSE,
                            category: 'Biaya Platform',
                            amount: marketplaceFee,
                            paymentMethod: data.paymentMethod,
                            bankAccountId: data.bankAccountId || null,
                            note: `Potongan marketplace Invoice ${invoiceNumber}${customerInfo}${branchInfo}${feeDetail}`,
                            branchName: effectiveBranchName,
                            branchId: branchId,
                            date: effectiveCashflowDate,
                            ...(diluarShift ? { excludeFromShift: true } : {}),
                        } as any
                    });
                }
            }

            // Diskon TIDAK dicatat sebagai pengeluaran: pemasukan di atas sudah bersih setelah
            // diskon (grandTotal = subtotal − diskon + …). Dulu dicatat juga → terpotong dua kali:
            // ekspektasi kas laci kurang sebesar diskon & laba bulanan turun.

            // Catat biaya sub-order (printing luar) sebagai pengeluaran saat nota dibuat.
            // subPrice = harga sub per m²/satuan (basis sama dgn priceAtTime), jadi biaya per item
            // = subPrice × luas × pcs (AREA) atau subPrice × qty (UNIT/custom).
            // Dicatat sebagai EXPENSE BANK_TRANSFER (non-kas): masuk laporan pengeluaran &
            // shift, TIDAK mengurangi kas laci. Dibuat terlepas dari DP (vendor tetap dibayar).
            let totalSubCost = 0;
            const subVendors = new Set<string>();
            for (const it of transactionItemsData) {
                if (!it.isSubOrder || !it.subPrice) continue;
                const sub = Number(it.subPrice) || 0;
                // Pengali sama dgn harga jual & laporan HPP: produk per cm² → luas cm², lainnya → m².
                // Dulu selalu /10000 → biaya sub produk per cm² tercatat 10.000× terlalu kecil.
                const cost = (Number(it.areaCm2) || 0) > 0
                    ? sub * storedPriceMultiplier({ unitType: (it as any).unitType, areaCm2: it.areaCm2 }) * (Number(it.pcs) || 1)
                    : sub * (Number(it.quantity) || 1);
                totalSubCost += cost;
                if (it.subVendor) subVendors.add(it.subVendor);
            }
            if (totalSubCost > 0) {
                const vendorInfo = subVendors.size ? ` — vendor: ${Array.from(subVendors).join(', ')}` : '';
                await tx.cashflow.create({
                    data: {
                        type: CashflowType.EXPENSE,
                        category: 'Biaya Sub / Printing Luar',
                        amount: Math.round(totalSubCost),
                        paymentMethod: 'BANK_TRANSFER',
                        bankAccountId: null,
                        note: `Biaya printing luar Invoice ${invoiceNumber}${customerInfo}${branchInfo}${vendorInfo}`,
                        branchName: effectiveBranchName,
                        branchId: branchId,
                        date: effectiveCashflowDate,
                        ...(diluarShift ? { excludeFromShift: true } : {}),
                    } as any
                });
            }

            // Hook: tandai SalesOrder sebagai INVOICED jika transaksi dibuat dari SO
            if (data.salesOrderId) {
                try {
                    const so = await (tx as any).salesOrder.findUnique({ where: { id: data.salesOrderId } });
                    // Label & marketplace dari SO ikut ke nota bila kasir tak mengisinya sendiri.
                    const fromSo: any = {};
                    if (so?.label && !(transaction as any).label) fromSo.label = so.label;
                    if (so?.marketplace && !(transaction as any).marketplace) {
                        fromSo.marketplace = so.marketplace;
                        fromSo.marketplaceOrderNo = so.marketplaceOrderNo ?? null;
                    }
                    if (Object.keys(fromSo).length) {
                        await (tx as any).transaction.update({ where: { id: transaction.id }, data: fromSo });
                    }
                    if (so && so.status !== 'CANCELLED' && !so.transactionId) {
                        await (tx as any).salesOrder.update({
                            where: { id: data.salesOrderId },
                            data: {
                                status: 'INVOICED',
                                invoicedAt: new Date(),
                                transactionId: transaction.id,
                            },
                        });
                    }
                    // Tutup Lead yang TERTAUT ke SO ini (Alur B: CS bikin lead lalu tautkan ke SO).
                    // Lead otomatis CLOSED_WON menunjuk nota yang SAMA → CS & desainer dapat kredit,
                    // tanpa nota dobel. Hanya lead yang belum closed yang disentuh.
                    const linkedLeads = await (tx as any).lead.findMany({
                        where: {
                            convertedSalesOrderId: data.salesOrderId,
                            status: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
                        },
                        select: { id: true },
                    });
                    for (const ld of linkedLeads) {
                        await (tx as any).lead.update({
                            where: { id: ld.id },
                            data: {
                                status: 'CLOSED_WON',
                                convertedTransactionId: transaction.id,
                                closedAt: new Date(),
                            },
                        });
                    }
                } catch (e) {
                    // Fail silently — transaksi sudah sukses, SO link bisa diperbaiki manual
                    console.error('Failed to mark SO as INVOICED / close linked lead', e);
                }
            }

            return transaction;
        }).then(async (result) => {
            // Cek stok menipis setelah transaksi selesai (di luar prisma.$transaction)
            this.checkLowStock(data.items.map(i => i.productVariantId).filter((id): id is number => id != null)).catch(() => { });

            // Kirim notif transaksi baru ke Discord
            this.notifyNewTransactionDiscord(result, data).catch(() => { });

            // Auto-create entri di Buku Titipan kalau ini titip cetak ke cabang lain.
            // Idempotent: kalau sudah ada untuk txId tsb, skip. Status awal PENDING — di-update
            // saat handover/pickup nanti (markHandover/confirmPickup juga panggil helper ini).
            this._createTitipanLedger(result.id).catch(err => {
                console.error('[createTitipanLedger] failed for tx', result.id, err);
            });

            return result;
        });
    }

    /**
     * Auto-create InterBranchLedger entry untuk transaksi titip cetak.
     * Dipanggil di:
     *   - Akhir _createTransaction (visibility langsung di Buku Titipan dari checkout)
     *   - branch-inbox.service.markHandover & confirmPickup (idempotent — duplicate aman)
     *
     * Formula (lihat detail di ledger-cost.util.ts → computeLedgerCost):
     *   bahanCost  = HPP variant utama + Σ BOM × HPP raw material (per item)
     *   klikCost   = Σ click_logs.total_cost (jasa cetak mesin paper)
     *   costAmount = bahanCost + klikCost   (disimpan gabung di kolom cost_amount)
     *   serviceFee = costAmount × (BranchSettings(toBranch).titipanFeePercent / 100, default 20)
     *   totalAmount = costAmount + serviceFee
     */
    /**
     * Setelah nota titip cetak DIEDIT: hitung ulang hutang titipan yang belum lunas (item/klik bisa
     * bertambah atau berkurang). Dulu nilai ledger dibuat sekali saat checkout dan tak pernah berubah —
     * cabang pemesan membayar untuk item yang sudah dihapus (atau kurang bayar untuk item tambahan).
     */
    private async _perbaruiTitipanLedger(txId: number): Promise<void> {
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT l.id, l.status, l.settled_amount, l.total_amount, t.production_branch_id AS to_branch
             FROM inter_branch_ledger l JOIN transactions t ON t.id = l.transaction_id
             WHERE l.transaction_id = ${Number(txId)} LIMIT 1`,
        );
        if (!rows.length) return this._createTitipanLedger(txId); // edit menambah item klik → ledger baru
        const l = rows[0];
        if (!['PENDING', 'PARTIAL'].includes(String(l.status))) {
            this.logger.warn(`Nota #${txId} diedit tetapi hutang titipan #${l.id} sudah ${l.status} — nilai tidak diubah.`);
            return;
        }
        const settingsRows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT titipan_fee_percent FROM branch_settings WHERE branch_id = ${Number(l.to_branch)} LIMIT 1`,
        );
        const feePercent = settingsRows.length && settingsRows[0].titipan_fee_percent != null ? Number(settingsRows[0].titipan_fee_percent) : 20;
        const cost = await computeLedgerCost(this.prisma, txId, feePercent);
        const costAmount = Math.round((cost.bahanCost + cost.klikCost) * 100) / 100;
        const total = cost.hasClickCost ? Number(cost.totalAmount) : 0;
        const dibayar = Number(l.settled_amount) || 0;
        const status = total <= 0 && dibayar <= 0 ? 'CANCELLED' : dibayar >= total ? 'SETTLED' : dibayar > 0 ? 'PARTIAL' : 'PENDING';
        await this.prisma.$executeRawUnsafe(
            `UPDATE inter_branch_ledger SET cost_amount = ?, service_fee = ?, total_amount = ?, status = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
            cost.hasClickCost ? costAmount : 0, cost.hasClickCost ? cost.serviceFee : 0, total, status, Number(l.id),
        );
    }

    private async _createTitipanLedger(txId: number): Promise<void> {
        // Cek existing (idempotent)
        const existing: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id FROM inter_branch_ledger WHERE transaction_id = ${txId} LIMIT 1`,
        );
        if (existing.length) return;

        const txRows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id, branch_id, production_branch_id
             FROM transactions WHERE id = ${txId} LIMIT 1`,
        );
        if (!txRows.length) return;
        const tx = txRows[0];
        const fromBranchId = tx.branch_id != null ? Number(tx.branch_id) : null;
        const toBranchId = tx.production_branch_id != null ? Number(tx.production_branch_id) : null;
        if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) return;

        // Resolve titipan fee percent dari cabang pelaksana
        const settingsRows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT titipan_fee_percent FROM branch_settings WHERE branch_id = ${toBranchId} LIMIT 1`,
        );
        const feePercent = settingsRows.length && settingsRows[0].titipan_fee_percent != null
            ? Number(settingsRows[0].titipan_fee_percent)
            : 20;

        // Hitung cost lengkap (bahan + klik + service fee)
        const cost = await computeLedgerCost(this.prisma, txId, feePercent);

        // Skip ledger untuk titipan banner-only (tidak ada biaya klik mesin).
        // Konsep bisnis: cabang titip cetak banner ke pusat tidak perlu ganti uang/bahan
        // (1 owner, 1 kantong). Tracking sudah lewat StockMovement & laporan
        // /reports/inter-branch-usage. Ledger formal hanya untuk titipan paper print
        // dimana cabang harus ganti bahan + bayar biaya klik.
        if (!cost.hasClickCost) {
            return;
        }

        const costAmount = Math.round((cost.bahanCost + cost.klikCost) * 100) / 100;

        await this.prisma.$executeRawUnsafe(
            `INSERT INTO inter_branch_ledger
              (transaction_id, from_branch_id, to_branch_id, cost_amount, service_fee, total_amount, settled_amount, status, created_at, updated_at)
             VALUES
              (${txId}, ${fromBranchId}, ${toBranchId}, ${costAmount}, ${cost.serviceFee}, ${cost.totalAmount}, 0, 'PENDING', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        );
    }

    private async notifyNewTransactionDiscord(transaction: any, data: any) {
        // Ambil nama produk dari DB
        const variantIds = data.items.map((i: any) => i.productVariantId);
        const variants = await this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            include: { product: true },
        });
        const variantMap = new Map(variants.map(v => [v.id, v]));

        // Bangun detail per item
        const itemLines = data.items.map((item: any, idx: number) => {
            const variant = variantMap.get(item.productVariantId);
            const productName = variant
                ? (variant.variantName
                    ? `${(variant as any).product?.name} - ${variant.variantName}`
                    : (variant as any).product?.name || 'Produk')
                : `Produk #${item.productVariantId}`;

            const txItem = (transaction.items || [])[idx];
            const price = txItem ? Number(txItem.priceAtTime) : 0;
            const priceStr = `Rp ${price.toLocaleString('id-ID')}`;

            // Format dimensi untuk produk area-based
            let dimensiStr = '';
            if (item.widthCm && item.heightCm) {
                const unit = normalizeUnit(item.unitType);
                if (unit === 'menit') {
                    dimensiStr = ` [${item.widthCm} unit]`;
                } else {
                    const suffix = unit === 'm' ? 'm' : 'cm';
                    dimensiStr = ` [${item.widthCm}×${item.heightCm}${suffix}]`;
                }
                if (item.pcs && item.pcs > 1) dimensiStr += ` ×${item.pcs}pcs`;
            } else if (item.quantity > 1) {
                dimensiStr = ` ×${item.quantity}`;
            }

            const noteStr = item.note ? `\n     📝 _${item.note}_` : '';

            return `  ${idx + 1}. **${productName}**${dimensiStr} — ${priceStr}${noteStr}`;
        }).join('\n');

        const customerName = data.customerName || 'Umum';
        const labelLine = (data as any).label ? `\n🏷️ Label: **${(data as any).label}**` : '';
        const marketplaceLine = (data as any).marketplace ? `\n🛍️ Marketplace: **${(data as any).marketplace}**` : '';
        const grandTotal = Number(transaction.grandTotal).toLocaleString('id-ID');
        const paymentLabel = data.paymentMethod === 'CASH' ? 'Tunai'
            : data.paymentMethod === 'QRIS' ? 'QRIS'
            : 'Transfer';
        const invoiceNumber = transaction.invoiceNumber || '-';
        const cashierLine = data.cashierName ? `\n👤 Kasir: ${data.cashierName}` : '';
        const employeeLine = data.employeeName ? `\n🧑‍🔧 Desainer/Operator: ${data.employeeName}` : '';

        // Estimasi deadline / jatuh tempo
        let deadlineLine = '';
        if (data.productionDeadline) {
            const dl = new Date(data.productionDeadline);
            const fmt = dl.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            deadlineLine = `\n📅 Estimasi Selesai: **${fmt}**`;
        } else if (data.dueDate) {
            const dl = new Date(data.dueDate);
            const fmt = dl.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            deadlineLine = `\n📅 Jatuh Tempo: **${fmt}**`;
        }

        const priorityLine = data.productionPriority === 'EXPRESS'
            ? '\n🚀 **PRIORITAS: EXPRESS**'
            : '';

        const orderNotes = data.productionNotes
            ? `\n📋 Catatan Order: _${data.productionNotes}_`
            : '';

        const message =
            `🛒 **Order Berhasil Masuk**\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 Invoice: \`${invoiceNumber}\`\n` +
            `👥 Pelanggan: **${customerName}**` +
            labelLine +
            marketplaceLine +
            cashierLine +
            employeeLine +
            deadlineLine +
            priorityLine +
            orderNotes +
            `\n\n**🧾 Detail Item:**\n${itemLines}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 Total: **Rp ${grandTotal}**  |  💳 ${paymentLabel}`;

        // Sistem multi-channel baru (Settings → Discord, channel #penjualan cabang)
        const txBranchId = (transaction as any).branchId ?? (data as any).branchId ?? null;
        await this.discord.sendLongReport('newTransaction', message, [], txBranchId);

        // Webhook legacy (settings.discordWebhookUrl) — tetap dikirim bila masih dikonfigurasi
        const settings = await this.prisma.storeSettings.findFirst();
        const discordUrl = (settings as any)?.discordWebhookUrl;
        if (discordUrl && (settings as any)?.notifyNewTransaction !== false) {
            await this.notificationsService.sendToDiscord(discordUrl, message);
        }
    }

    // Varian → waktu peringatan terakhir. Dulu SETIAP penjualan barang yang stoknya sudah di bawah
    // ambang mengirim notifikasi + 2 pesan Discord lagi.
    private readonly peringatanStok = new Map<number, number>();

    private async checkLowStock(variantIds: number[]) {
        const settings = await this.prisma.storeSettings.findFirst();
        if (!(settings as any)?.notifyLowStock) return;
        const threshold = (settings as any)?.lowStockThreshold ?? 5;

        const variants = await this.prisma.productVariant.findMany({
            where: {
                id: { in: variantIds },
                product: { trackStock: true }, // Hanya produk yang tracking stok
            },
            include: { product: true },
        });

        const sekarang = Date.now();
        for (const variant of variants) {
            if (variant.stock > threshold) { this.peringatanStok.delete(variant.id); continue; }
            const terakhir = this.peringatanStok.get(variant.id) ?? 0;
            if (sekarang - terakhir < 12 * 3600_000) continue; // sudah diperingatkan ≤ 12 jam lalu
            this.peringatanStok.set(variant.id, sekarang);
            {
                const name = variant.variantName
                    ? `${(variant as any).product?.name} - ${variant.variantName}`
                    : (variant as any).product?.name || 'Produk';
                this.notificationsService.emit({
                    type: 'stock',
                    title: 'Stok Hampir Habis',
                    message: `${name}: sisa ${variant.stock} ${(variant as any).product?.unit || 'pcs'}`,
                });
                const discordUrl = (settings as any)?.discordWebhookUrl;
                if (discordUrl) {
                    await this.notificationsService.sendToDiscord(
                        discordUrl,
                        `⚠️ **Stok Hampir Habis**\n${name}: sisa **${variant.stock}** unit`,
                    );
                }
                // Notifikasi Discord (channel #stok-gudang) via DiscordService baru
                this.discord.notifyLowStock({
                    name,
                    sku: (variant as any).sku ?? undefined,
                    stock: variant.stock,
                    threshold,
                });
            }
        }
    }

    async findAll(branchCtx?: BranchContext, startDate?: string, endDate?: string, search?: string, status?: string) {
        const where: any = branchCtx ? { ...branchWhere(branchCtx) } : {};
        // Filter status DI SERVER. Halaman DP/Piutang cuma butuh nota belum lunas
        // (62 baris dari 6.017). Tanpa ini seluruh tabel ikut terkirim: ~28 MB JSON
        // yang memblokir event loop Node ~400 ms saat diserialisasi -> daftar produk,
        // POS, dan login ikut menggantung selama itu. Whitelist enum: nilai asing
        // diabaikan (bukan dilempar ke Prisma) agar query tak gagal karena typo.
        const STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'FAILED'];
        const wanted = (status || '')
            .split(',')
            .map((x) => x.trim().toUpperCase())
            .filter((x) => STATUSES.includes(x));
        if (wanted.length) where.status = { in: wanted };
        if (startDate && endDate) {
            where.createdAt = {
                gte: awalHari(startDate),
                lte: akhirHari(endDate),
            };
        }
        if (search) {
            where.OR = [
                { customerName: { contains: search } },
                { invoiceNumber: { contains: search } },
            ];
        }
        return this.prisma.transaction.findMany({
            where,
            include: {
                items: {
                    include: { productVariant: { include: { product: true } } }
                },
                bankAccount: true,
                branch: { include: { settings: true } }, productionBranch: { include: { settings: true } },
            } as any,
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Pastikan staff hanya bisa mengakses transaksi cabangnya sendiri.
     * Owner / mode "Semua Cabang" (branchCtx undefined) dilewati.
     * Dipanggil di semua operasi by-ID (baca/bayar/edit/hapus) agar staff
     * cabang lain tidak bisa intip atau ubah transaksi lewat tebak ID.
     */
    private async assertTxBranchAccess(id: number, branchCtx?: BranchContext) {
        if (!branchCtx) return;
        const row = await this.prisma.transaction.findUnique({
            where: { id },
            select: { branchId: true } as any,
        });
        if (!row) throw new NotFoundException('Transaction not found');
        assertBranchAccess(branchCtx, (row as any).branchId ?? null);
    }

    async findOne(id: number, branchCtx?: BranchContext) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
            include: {
                items: {
                    include: { productVariant: { include: { product: true } } }
                },
                printJobs: true,
                salesOrder: { select: { id: true, soNumber: true, status: true } },
                branch: { include: { settings: true } }, productionBranch: { include: { settings: true } },
            } as any,
        });
        if (!transaction) throw new NotFoundException('Transaction not found');
        assertBranchAccess(branchCtx ?? { isOwner: true, branchId: null, userBranchId: null, roleName: null }, (transaction as any).branchId ?? null);
        // Nama akun pengubah harga manual (T-32) untuk ditampilkan di detail nota.
        const ids = [...new Set((transaction as any).items.map((i: any) => i.priceOverrideById).filter(Boolean))] as number[];
        if (ids.length) {
            const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
            const nama = new Map(users.map((u) => [u.id, u.name]));
            for (const it of (transaction as any).items) if (it.priceOverrideById) it.priceOverrideByName = nama.get(it.priceOverrideById) ?? null;
        }
        return transaction;
    }

    /** Rekening tujuan pembayaran harus aktif & milik cabang nota (atau rekening bersama). */
    private async cekRekeningNota(db: any, bid: unknown, cabangNota: number | null) {
        if (!bid) return;
        const bank: any = await db.bankAccount.findUnique({ where: { id: Number(bid) } });
        if (!bank || bank.isActive === false) throw new BadRequestException('Rekening bank tujuan tidak ditemukan / nonaktif.');
        if (bank.branchId != null && cabangNota != null && bank.branchId !== cabangNota) {
            throw new BadRequestException('Rekening bank milik cabang lain — pilih rekening cabang ini.');
        }
    }

    async addPartialPayment(id: number, data: { amount: number; paymentMethod: PaymentMethod; bankAccountId?: number }, branchCtx?: BranchContext) {
        await this.assertTxBranchAccess(id, branchCtx);
        return this.ulangBilaBentrok(() => this.prisma.$transaction(async (tx) => {
            await this.lockTransactionRow(tx, id);
            const transaction = await tx.transaction.findUnique({ where: { id } });
            if (!transaction) throw new NotFoundException('Transaction not found');
            if (transaction.status === TransactionStatus.PAID) throw new BadRequestException('Transaksi sudah lunas');
            if (transaction.status !== TransactionStatus.PARTIAL && transaction.status !== TransactionStatus.PENDING)
                throw new BadRequestException('Transaksi tidak dapat menerima pembayaran');
            // Dulu DP/pelunasan menerima rekening nonaktif atau milik cabang lain (checkout sudah menolak).
            await this.cekRekeningNota(tx, data.bankAccountId, (transaction as any).branchId ?? null);

            const currentDP = Number(transaction.downPayment);
            const grandTotal = Number(transaction.grandTotal);
            const remaining = grandTotal - currentDP;
            const amount = Number(data.amount);

            if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Nominal harus lebih dari 0');
            if (amount > remaining + 0.005) throw new BadRequestException('Nominal melebihi sisa tagihan');
            data = { ...data, amount };

            const newDP = currentDP + data.amount;
            const willBePaid = newDP >= grandTotal;
            const customerInfo = transaction.customerName ? ` untuk Bpk/Ibu ${transaction.customerName}` : '';
            const branchInfoDP = (transaction as any).branchName ? ` [${(transaction as any).branchName}]` : '';

            await tx.cashflow.create({
                data: {
                    type: CashflowType.INCOME,
                    category: willBePaid ? 'Pelunasan DP' : 'Pembayaran DP',
                    amount: data.amount,
                    paymentMethod: data.paymentMethod,
                    bankAccountId: data.bankAccountId || null,
                    note: `Pembayaran DP Invoice ${transaction.invoiceNumber}${customerInfo}${branchInfoDP} via ${data.paymentMethod}`,
                    branchName: (transaction as any).branchName || null,
                    branchId: (transaction as any).branchId ?? null,
                    date: new Date(),
                } as any
            });

            if (willBePaid) {
                // Biaya platform marketplace dicatat saat nota LUNAS (sama seperti jalur "Lunasi").
                // Dulu jalur tambah-DP yang melunasi tidak mencatatnya → saldo bank terlihat lebih.
                const storedFee = Number((transaction as any).marketplaceFee) || 0;
                if (storedFee > 0) {
                    const sudahAda = await this.cashflowsOfInvoice(tx, transaction.invoiceNumber, { type: CashflowType.EXPENSE, category: 'Biaya Platform' });
                    if (!sudahAda.length) {
                        const feeItems = Array.isArray((transaction as any).marketplaceFeeItems) ? (transaction as any).marketplaceFeeItems : null;
                        await tx.cashflow.create({
                            data: {
                                type: CashflowType.EXPENSE,
                                category: 'Biaya Platform',
                                amount: storedFee,
                                paymentMethod: data.paymentMethod,
                                bankAccountId: data.bankAccountId || null,
                                note: `Potongan marketplace Invoice ${transaction.invoiceNumber}${customerInfo}${branchInfoDP}${this.formatFeeDetail(feeItems)}`,
                                branchName: (transaction as any).branchName || null,
                                branchId: (transaction as any).branchId ?? null,
                                date: new Date(),
                            } as any
                        });
                    }
                }
                // Promosi ke PAID — generate SC number (per cabang, ikut cabang transaksi)
                const now = new Date();
                const cy = now.getFullYear();
                const cm = String(now.getMonth() + 1).padStart(2, '0');
                const cd = String(now.getDate()).padStart(2, '0');
                const scCode = await this.branchCodeFor(tx, (transaction as any).branchId ?? null);
                const scPrefix = scCode ? `SC-${scCode}-${cy}${cm}${cd}-` : `SC-${cy}${cm}${cd}-`;
                const lastSC = await tx.transaction.findFirst({
                    where: { checkoutNumber: { startsWith: scPrefix } },
                    orderBy: { checkoutNumber: 'desc' },
                    select: { checkoutNumber: true },
                });
                const nextSCSeq = lastSC ? parseInt(lastSC.checkoutNumber!.slice(scPrefix.length), 10) + 1 : 1;
                const checkoutNumber = `${scPrefix}${nextSCSeq.toString().padStart(4, '0')}`;

                return tx.transaction.update({
                    where: { id },
                    data: {
                        downPayment: newDP,
                        status: TransactionStatus.PAID,
                        paymentMethod: data.paymentMethod,
                        bankAccountId: data.bankAccountId ?? null,
                        checkoutNumber,
                        paidAt: now,
                    }
                });
            }

            return tx.transaction.update({
                where: { id },
                data: {
                    downPayment: newDP,
                    status: TransactionStatus.PARTIAL,
                    dpPaymentMethod: data.paymentMethod,
                    dpBankAccountId: data.bankAccountId ?? null,
                } as any
            });
        }));
    }

    async payOff(id: number, data: { paymentMethod: PaymentMethod, bankAccountId?: number, checkoutCashierName?: string, paidAt?: string, marketplaceFee?: number, marketplaceFeeItems?: { name: string; amount: number }[] }, branchCtx?: BranchContext) {
        await this.assertTxBranchAccess(id, branchCtx);
        return this.ulangBilaBentrok(() => this.prisma.$transaction(async (tx) => {
            await this.lockTransactionRow(tx, id);
            const transaction = await tx.transaction.findUnique({ where: { id } });
            if (!transaction) throw new NotFoundException('Transaction not found');
            if (transaction.status === TransactionStatus.PAID) throw new BadRequestException('Transaksi sudah lunas');
            if (transaction.status !== TransactionStatus.PARTIAL && transaction.status !== TransactionStatus.PENDING)
                throw new BadRequestException('Transaksi tidak dapat dilunasi');
            await this.cekRekeningNota(tx, data.bankAccountId, (transaction as any).branchId ?? null);
            const feeMasuk = data.marketplaceFeeItems?.length
                ? data.marketplaceFeeItems.map((f) => Number(f.amount))
                : data.marketplaceFee != null ? [Number(data.marketplaceFee)] : [];
            if (feeMasuk.some((n) => !Number.isFinite(n) || n < 0)) throw new BadRequestException('Biaya platform tidak boleh negatif.');
            if (feeMasuk.reduce((s, n) => s + n, 0) > Number(transaction.grandTotal)) throw new BadRequestException('Biaya platform melebihi total nota.');

            const remainingBalance = Number(transaction.grandTotal) - Number(transaction.downPayment);

            // Fee dari input saat pelunasan (prioritas) atau fee yang sudah tersimpan di transaksi
            const incomingFeeItems = data.marketplaceFeeItems && data.marketplaceFeeItems.length > 0
                ? data.marketplaceFeeItems
                : null;
            const incomingFeeTotal = incomingFeeItems
                ? incomingFeeItems.reduce((s, f) => s + (Number(f.amount) || 0), 0)
                : (data.marketplaceFee || 0);
            const storedFee = Number((transaction as any).marketplaceFee) || 0;
            const effectiveFeeItems = incomingFeeItems ?? (Array.isArray((transaction as any).marketplaceFeeItems) ? (transaction as any).marketplaceFeeItems : null);
            const txMarketplaceFee = incomingFeeTotal > 0 ? incomingFeeTotal : storedFee;

            // Simpan fee ke transaksi jika ada fee baru dari input pelunasan
            if (incomingFeeTotal > 0) {
                await tx.transaction.update({
                    where: { id },
                    data: {
                        marketplaceFee: incomingFeeTotal,
                        marketplaceFeeItems: effectiveFeeItems ?? undefined,
                    } as any,
                });
            }

            // Tentukan tanggal checkout (manual dari kasir, atau sekarang)
            const checkoutDate = data.paidAt ? new Date(data.paidAt) : new Date();

            if (remainingBalance > 0) {
                const customerInfo = transaction.customerName ? ` untuk Bpk/Ibu ${transaction.customerName}` : '';
                const branchInfoPO = (transaction as any).branchName ? ` [${(transaction as any).branchName}]` : '';
                const isFromPending = transaction.status === TransactionStatus.PENDING;
                // Income = GROSS (sisa tagihan penuh). Potongan platform dicatat
                // SEKALI sebagai expense "Biaya Platform" di bawah — supaya saldo
                // turun tepat 1× fee dan omzet kotor tetap akurat (bukan dobel).
                const incomeAmount = remainingBalance;
                await tx.cashflow.create({
                    data: {
                        type: CashflowType.INCOME,
                        category: isFromPending ? 'Penjualan Lunas' : 'Pelunasan DP',
                        amount: incomeAmount,
                        paymentMethod: data.paymentMethod,
                        bankAccountId: data.bankAccountId || null,
                        note: `${isFromPending ? 'Pembayaran' : 'Pelunasan'} Invoice ${transaction.invoiceNumber}${customerInfo}${branchInfoPO} via ${data.paymentMethod}`,
                        branchName: (transaction as any).branchName || null,
                        branchId: (transaction as any).branchId ?? null,
                        date: checkoutDate,
                    } as any
                });
                if (txMarketplaceFee > 0) {
                    const feeDetail = this.formatFeeDetail(effectiveFeeItems);
                    await tx.cashflow.create({
                        data: {
                            type: CashflowType.EXPENSE,
                            category: 'Biaya Platform',
                            amount: txMarketplaceFee,
                            paymentMethod: data.paymentMethod,
                            bankAccountId: data.bankAccountId || null,
                            note: `Potongan marketplace Invoice ${transaction.invoiceNumber}${customerInfo}${branchInfoPO}${feeDetail}`,
                            branchName: (transaction as any).branchName || null,
                            branchId: (transaction as any).branchId ?? null,
                            date: checkoutDate,
                        } as any
                    });
                }
            }

            // Generate nomor SC berdasarkan tanggal checkout (per cabang, ikut cabang transaksi)
            const cy = checkoutDate.getFullYear();
            const cm = String(checkoutDate.getMonth() + 1).padStart(2, '0');
            const cd = String(checkoutDate.getDate()).padStart(2, '0');
            const scCode = await this.branchCodeFor(tx, (transaction as any).branchId ?? null);
            const scPrefix = scCode ? `SC-${scCode}-${cy}${cm}${cd}-` : `SC-${cy}${cm}${cd}-`;

            const lastSC = await tx.transaction.findFirst({
                where: { checkoutNumber: { startsWith: scPrefix } },
                orderBy: { checkoutNumber: 'desc' },
                select: { checkoutNumber: true },
            });
            const nextSCSeq = lastSC ? parseInt(lastSC.checkoutNumber!.slice(scPrefix.length), 10) + 1 : 1;
            const checkoutNumber = `${scPrefix}${nextSCSeq.toString().padStart(4, '0')}`;

            return tx.transaction.update({
                where: { id },
                data: {
                    status: TransactionStatus.PAID,
                    paymentMethod: data.paymentMethod,
                    bankAccountId: data.bankAccountId ?? null,
                    checkoutNumber,
                    paidAt: checkoutDate,
                    checkoutCashierName: data.checkoutCashierName ?? null,
                    // downPayment TIDAK ditimpa — tetap menyimpan jumlah DP asli
                    // Status PAID sudah cukup sebagai penanda "lunas penuh"
                }
            });
        }));
    }

    async updatePaymentMethod(id: number, data: { paymentMethod: PaymentMethod; bankAccountId?: number }, branchCtx?: BranchContext) {
        await this.assertTxBranchAccess(id, branchCtx);
        if (!['CASH', 'QRIS', 'BANK_TRANSFER'].includes(String(data.paymentMethod))) throw new BadRequestException('Metode bayar tidak dikenal.');
        const bankAccountId = data.paymentMethod === 'BANK_TRANSFER' ? Number(data.bankAccountId) || null : null;
        return this.prisma.$transaction(async (tx) => {
            await this.lockTransactionRow(tx, id);
            const transaction = await tx.transaction.findUniqueOrThrow({ where: { id } });
            if (transaction.status === TransactionStatus.PENDING) throw new BadRequestException('Nota belum dibayar — belum ada metode bayar untuk diubah.');
            if (data.paymentMethod === 'BANK_TRANSFER') {
                const bank = bankAccountId ? await tx.bankAccount.findUnique({ where: { id: bankAccountId } }) : null;
                const txBranch = (transaction as any).branchId ?? null;
                if (!bank || !(bank as any).isActive) throw new BadRequestException('Pilih rekening bank tujuan yang aktif.');
                if ((bank as any).branchId != null && txBranch != null && (bank as any).branchId !== txBranch) throw new BadRequestException('Rekening bank milik cabang lain.');
            }
            const isPaid = transaction.status === TransactionStatus.PAID;
            const lamaMetode = isPaid ? transaction.paymentMethod : ((transaction as any).dpPaymentMethod ?? transaction.paymentMethod);
            const lamaBank = isPaid ? (transaction.bankAccountId ?? null) : ((transaction as any).dpBankAccountId ?? transaction.bankAccountId ?? null);

            // Hanya pembayaran TERAKHIR (yang metodenya ditampilkan) + biaya platformnya yang dipindah.
            // Dulu SEMUA pemasukan nota ikut pindah — DP via BCA ikut jadi QRIS, saldo bank meleset.
            const masuk = (await this.cashflowsOfInvoice(tx, transaction.invoiceNumber, { type: CashflowType.INCOME }))
                .filter((c) => c.paymentMethod === lamaMetode && (c.bankAccountId ?? null) === lamaBank);
            const terakhir = masuk[0];
            const fee = (await this.cashflowsOfInvoice(tx, transaction.invoiceNumber, { type: CashflowType.EXPENSE, category: 'Biaya Platform' }))
                .filter((c) => c.paymentMethod === lamaMetode && (c.bankAccountId ?? null) === lamaBank);
            const ids = [terakhir?.id, ...fee.map((c) => c.id)].filter((x): x is number => x != null);
            if (ids.length) {
                await tx.cashflow.updateMany({
                    where: { id: { in: ids } },
                    data: { paymentMethod: data.paymentMethod, bankAccountId },
                });
            }

            return tx.transaction.update({
                where: { id },
                data: isPaid
                    ? { paymentMethod: data.paymentMethod, bankAccountId }
                    : ({ dpPaymentMethod: data.paymentMethod, dpBankAccountId: bankAccountId, ...(transaction.paymentMethod === lamaMetode ? { paymentMethod: data.paymentMethod, bankAccountId } : {}) } as any),
            });
        });
    }

    async getSummaryReport(branchCtx: BranchContext | undefined, startDate?: string, endDate?: string, sortBy: 'qty' | 'revenue' = 'qty', limit: number = 20) {
        // Gunakan paidAt (tanggal pembayaran/checkout) sebagai acuan, bukan createdAt/updatedAt.
        // Nota PENDING yang dibuat hari X tapi dibayar hari Y masuk ke laporan hari Y.
        // JANGAN pakai updatedAt: ia berubah pada setiap edit/koreksi/migrasi, sehingga
        // nota lama ikut tertarik ke periode berjalan dengan nilai penuh.
        const bw = branchCtx ? branchWhere(branchCtx) : {};
        const whereClause: any = { status: TransactionStatus.PAID, ...bw };
        if (startDate && endDate) {
            whereClause.paidAt = {
                gte: awalHari(startDate),
                lte: akhirHari(endDate)
            };
        }
        const transactions = await this.prisma.transaction.findMany({
            where: whereClause,
            include: {
                items: { include: { productVariant: { include: { product: true } } } },
                bankAccount: true
            }
        });

        // Hitung prev-period untuk trend comparison
        let prevItemSales: Record<number, { qty: number, revenue: number }> = {};
        if (startDate && endDate) {
            const start = awalHari(startDate);
            const end = akhirHari(endDate);
            const durationMs = end.getTime() - start.getTime();
            const prevEnd = new Date(start.getTime() - 1);
            const prevStart = new Date(prevEnd.getTime() - durationMs);
            const prevTransactions = await this.prisma.transaction.findMany({
                where: {
                    status: TransactionStatus.PAID,
                    paidAt: { gte: prevStart, lte: prevEnd },
                    ...(branchCtx ? branchWhere(branchCtx) : {}),
                },
                include: {
                    items: { include: { productVariant: true } }
                }
            });
            for (const t of prevTransactions) {
                for (const item of t.items) {
                    const vid = item.productVariantId;
                    if (!vid) continue;
                    if (!prevItemSales[vid]) prevItemSales[vid] = { qty: 0, revenue: 0 };
                    prevItemSales[vid].qty += item.areaCm2 ? Math.max(1, Number((item as any).pcs) || 1) : item.quantity;
                    prevItemSales[vid].revenue += lineTotalOf(item as any); // area: harga × luas × pcs
                }
            }
        }

        let totalRevenue = 0;
        const totalTransactions = transactions.length;
        const paymentMethodsCount: Record<string, number> = { CASH: 0, QRIS: 0, BANK_TRANSFER: 0 };
        const paymentMethodsRevenue: Record<string, number> = { CASH: 0, QRIS: 0, BANK_TRANSFER: 0 };
        const bankTransfersRevenue: Record<string, number> = {};
        const itemSales: Record<number, { variantId: number, name: string, variantName: string | null, sku: string, qty: number, revenue: number }> = {};

        for (const t of transactions) {
            const grandTotal = Number(t.grandTotal);
            const dpAmount = Number(t.downPayment);
            const dpMethod: string | null = (t as any).dpPaymentMethod || null;
            totalRevenue += grandTotal;

            if (dpMethod && dpAmount > 0) {
                // Transaksi DP yang sudah lunas: split revenue antara DP method dan pelunasan method
                const pelunasanAmount = grandTotal - dpAmount;
                paymentMethodsCount[t.paymentMethod] = (paymentMethodsCount[t.paymentMethod] || 0) + 1;
                paymentMethodsRevenue[dpMethod] = (paymentMethodsRevenue[dpMethod] || 0) + dpAmount;
                paymentMethodsRevenue[t.paymentMethod] = (paymentMethodsRevenue[t.paymentMethod] || 0) + pelunasanAmount;

                // Bank transfer breakdown untuk DP
                if (dpMethod === 'BANK_TRANSFER') {
                    const dpBankId: number | null = (t as any).dpBankAccountId || null;
                    const dpBank = dpBankId ? (t as any).dpBankAccount?.bankName : null;
                    if (dpBank) bankTransfersRevenue[dpBank] = (bankTransfersRevenue[dpBank] || 0) + dpAmount;
                }
                // Bank transfer breakdown untuk pelunasan
                if (t.paymentMethod === 'BANK_TRANSFER' && t.bankAccount) {
                    const bankName = t.bankAccount.bankName;
                    bankTransfersRevenue[bankName] = (bankTransfersRevenue[bankName] || 0) + pelunasanAmount;
                }
            } else {
                // Transaksi biasa: hitung penuh ke satu metode
                paymentMethodsCount[t.paymentMethod] = (paymentMethodsCount[t.paymentMethod] || 0) + 1;
                paymentMethodsRevenue[t.paymentMethod] = (paymentMethodsRevenue[t.paymentMethod] || 0) + grandTotal;
                if (t.paymentMethod === 'BANK_TRANSFER' && t.bankAccount) {
                    const bankName = t.bankAccount.bankName;
                    bankTransfersRevenue[bankName] = (bankTransfersRevenue[bankName] || 0) + grandTotal;
                }
            }

            for (const item of t.items) {
                const variantId = item.productVariantId;
                if (!variantId || !item.productVariant) continue;
                if (!itemSales[variantId]) {
                    itemSales[variantId] = {
                        variantId,
                        name: item.productVariant.product.name,
                        variantName: item.productVariant.variantName,
                        sku: item.productVariant.sku,
                        qty: 0,
                        revenue: 0,
                    };
                }
                // Item area disimpan qty 1 & harga per m²/cm² → jumlah = pcs, pendapatan = total baris
                // (dulu "1 pcs · Rp 25.000" untuk banner 2 pcs senilai Rp 150.000).
                itemSales[variantId].qty += item.areaCm2 ? Math.max(1, Number((item as any).pcs) || 1) : item.quantity;
                itemSales[variantId].revenue += lineTotalOf(item as any);
            }
        }

        const topSellingItems = Object.values(itemSales)
            .sort((a, b) => sortBy === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty)
            .slice(0, limit)
            .map(item => {
                const prev = prevItemSales[item.variantId];
                const prevQty = prev?.qty ?? 0;
                const prevRevenue = prev?.revenue ?? 0;
                const trendPercent = prevQty === 0
                    ? null
                    : Math.round(((item.qty - prevQty) / prevQty) * 1000) / 10;
                const trendRevenuePercent = prevRevenue === 0
                    ? null
                    : Math.round(((item.revenue - prevRevenue) / prevRevenue) * 1000) / 10;
                return {
                    variantId: item.variantId,
                    name: item.name,
                    variantName: item.variantName,
                    sku: item.sku,
                    qty: item.qty,
                    revenue: item.revenue,
                    prevQty,
                    prevRevenue,
                    trendPercent,
                    trendRevenuePercent,
                };
            });

        // Pendapatan Kas (cash basis): sum cashflow auto-entry dalam rentang tanggal.
        // Berbeda dengan totalRevenue (accrual) — DP dan pelunasan dihitung di tanggal masing-masing.
        const cfWhere: any = { type: CashflowType.INCOME, userId: null, category: { in: KATEGORI_PENJUALAN }, ...bw };
        if (startDate && endDate) {
            cfWhere.createdAt = {
                gte: awalHari(startDate),
                lte: akhirHari(endDate),
            };
        }
        const cfAgg = await this.prisma.cashflow.aggregate({
            where: cfWhere,
            _sum: { amount: true },
        });
        const pendapatanKas = Number(cfAgg._sum.amount || 0);

        return {
            totalRevenue,
            pendapatanKas,
            totalTransactions,
            averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
            paymentMethods: paymentMethodsCount,
            paymentMethodsRevenue,
            bankTransfersRevenue,
            topSellingItems,
        };
    }

    async getChartData(period: string = 'daily', branchCtx?: BranchContext) {
        const bw = branchCtx ? branchWhere(branchCtx) : {};
        // Menggunakan cashflow auto-entry (userId: null, type: INCOME) sebagai single source of truth.
        // Konsisten dengan card dashboard — memisahkan DP vs pelunasan di tanggal masing-masing.
        const now = new Date();
        const data: { label: string; total: number }[] = [];

        if (period === 'daily') {
            // Last 7 days, per day
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            const cfs = await this.prisma.cashflow.findMany({
                where: { createdAt: { gte: start }, type: CashflowType.INCOME, userId: null, category: { in: KATEGORI_PENJUALAN }, ...bw },
                select: { createdAt: true, amount: true }
            });
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dateStr = ymdLokal(d); // hari WIB (dulu UTC: penjualan 00–07 WIB jatuh ke kemarin)
                const total = cfs
                    .filter(c => c.createdAt && ymdLokal(c.createdAt) === dateStr)
                    .reduce((sum, c) => sum + Number(c.amount), 0);
                data.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, total });
            }
        } else if (period === 'weekly') {
            // Last 8 weeks, per week
            for (let i = 7; i >= 0; i--) {
                const weekEnd = new Date(now);
                weekEnd.setDate(weekEnd.getDate() - i * 7);
                weekEnd.setHours(23, 59, 59, 999);
                const weekStart = new Date(weekEnd);
                weekStart.setDate(weekStart.getDate() - 6);
                weekStart.setHours(0, 0, 0, 0);
                const result = await this.prisma.cashflow.aggregate({
                    where: { createdAt: { gte: weekStart, lte: weekEnd }, type: CashflowType.INCOME, userId: null, category: { in: KATEGORI_PENJUALAN }, ...bw },
                    _sum: { amount: true }
                });
                const d = weekStart.getDate();
                const m = weekStart.getMonth() + 1;
                data.push({ label: `${d}/${m}`, total: Number(result._sum.amount || 0) });
            }
        } else if (period === 'monthly') {
            // Last 12 months, per month
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
                const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
                const result = await this.prisma.cashflow.aggregate({
                    where: { createdAt: { gte: monthStart, lte: monthEnd }, type: CashflowType.INCOME, userId: null, category: { in: KATEGORI_PENJUALAN }, ...bw },
                    _sum: { amount: true }
                });
                data.push({ label: `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, total: Number(result._sum.amount || 0) });
            }
        } else if (period === 'yearly') {
            // Last 5 years, per year
            for (let i = 4; i >= 0; i--) {
                const year = now.getFullYear() - i;
                const yearStart = new Date(year, 0, 1);
                const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
                const result = await this.prisma.cashflow.aggregate({
                    where: { createdAt: { gte: yearStart, lte: yearEnd }, type: CashflowType.INCOME, userId: null, category: { in: KATEGORI_PENJUALAN }, ...bw },
                    _sum: { amount: true }
                });
                data.push({ label: String(year), total: Number(result._sum.amount || 0) });
            }
        }

        return data;
    }

    async getCashierStats(branchCtx: BranchContext | undefined, startDate?: string, endDate?: string) {
        const bw = branchCtx ? branchWhere(branchCtx) : {};
        let start: Date;
        let end: Date;

        if (startDate && endDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            // Default: hari ini
            start = new Date();
            start.setHours(0, 0, 0, 0);
            end = new Date();
            end.setHours(23, 59, 59, 999);
        }

        // Ambil semua transaksi PAID dalam rentang tanggal (berdasarkan waktu lunas)
        const transactions = await this.prisma.transaction.findMany({
            where: { paidAt: { gte: start, lte: end }, status: TransactionStatus.PAID, ...bw },
            select: { cashierName: true, checkoutCashierName: true, grandTotal: true },
        });

        const stats: Record<string, { name: string; count: number; revenue: number }> = {};

        for (const tx of transactions) {
            // Prioritaskan checkoutCashierName (yang melunasi), fallback ke cashierName (yang buat invoice)
            const name = tx.checkoutCashierName || tx.cashierName || 'Tidak Diketahui';
            if (!stats[name]) stats[name] = { name, count: 0, revenue: 0 };
            stats[name].count++;
            stats[name].revenue += Number(tx.grandTotal);
        }

        return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
    }

    async getDashboardMetrics(branchCtx?: BranchContext) {
        const bw = branchCtx ? branchWhere(branchCtx) : {};
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        // Cashflow auto-entries (userId: null) = dibuat oleh sistem saat transaksi PAID.
        // Menggunakan createdAt cashflow sebagai acuan waktu pembayaran, bukan createdAt transaksi.
        // Ini memastikan nota PENDING yang dibayar hari ini tetap terhitung di dashboard hari ini.
        const [
            todaySalesAgg,     // Revenue hari ini (berdasarkan waktu bayar)
            yesterdaySalesAgg, // Revenue kemarin
            todayTxCount,      // Jumlah transaksi lunas hari ini (berdasarkan paidAt)
            yesterdayTxCount,  // Jumlah transaksi lunas kemarin
            todayCashflow,     // Total cashflow masuk hari ini (semua, untuk card cashflow)
            yesterdayCashflow, // Total cashflow masuk kemarin
            lowStockItems,
        ] = await Promise.all([
            // Sales card: sum cashflow auto-income hari ini (userId null = auto dari transaksi)
            this.prisma.cashflow.aggregate({
                where: { createdAt: { gte: todayStart }, type: CashflowType.INCOME, userId: null, category: { in: KATEGORI_PENJUALAN }, ...bw },
                _sum: { amount: true },
            }),
            this.prisma.cashflow.aggregate({
                where: { createdAt: { gte: yesterdayStart, lt: todayStart }, type: CashflowType.INCOME, userId: null, category: { in: KATEGORI_PENJUALAN }, ...bw },
                _sum: { amount: true },
            }),
            // Tx count: hitung transaksi yang statusnya PAID dan dibayar (paidAt) hari ini
            this.prisma.transaction.count({
                where: { paidAt: { gte: todayStart }, status: TransactionStatus.PAID, ...bw },
            }),
            this.prisma.transaction.count({
                where: { paidAt: { gte: yesterdayStart, lt: todayStart }, status: TransactionStatus.PAID, ...bw },
            }),
            // Cashflow card: semua income hari ini (termasuk manual)
            this.prisma.cashflow.aggregate({
                where: { createdAt: { gte: todayStart }, type: CashflowType.INCOME, ...bw },
                _sum: { amount: true },
            }),
            this.prisma.cashflow.aggregate({
                where: { createdAt: { gte: yesterdayStart, lt: todayStart }, type: CashflowType.INCOME, ...bw },
                _sum: { amount: true },
            }),
            this.prisma.productVariant.findMany({
                where: { stock: { lte: 10 }, product: { trackStock: true } },
                include: { product: true },
                orderBy: { stock: 'asc' },
                take: 5,
            }),
        ]);

        // Get last 7 days sales for chart (berdasarkan cashflow payment date)
        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

        const recentCashflow = await this.prisma.cashflow.findMany({
            where: {
                createdAt: { gte: sevenDaysAgo },
                type: CashflowType.INCOME,
                userId: null, // auto-created dari transaksi
                category: { in: KATEGORI_PENJUALAN },
                ...bw,
            },
            select: { createdAt: true, amount: true },
        });

        // Group by Date for Chart
        const salesChartData: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            salesChartData[dateStr] = 0;
        }

        recentCashflow.forEach(cf => {
            if (cf.createdAt) {
                const dateStr = `${cf.createdAt.getFullYear()}-${String(cf.createdAt.getMonth() + 1).padStart(2, '0')}-${String(cf.createdAt.getDate()).padStart(2, '0')}`;
                if (salesChartData[dateStr] !== undefined) {
                    salesChartData[dateStr] += Number(cf.amount);
                }
            }
        });

        const salesChart = Object.keys(salesChartData).map(date => ({
            date,
            total: salesChartData[date],
        }));

        const todaySales = Number(todaySalesAgg._sum.amount || 0);
        const yesterdaySales = Number(yesterdaySalesAgg._sum.amount || 0);
        const salesTrend = yesterdaySales === 0 ? 100 : ((todaySales - yesterdaySales) / yesterdaySales) * 100;
        const txTrend = yesterdayTxCount === 0 ? 100 : ((todayTxCount - yesterdayTxCount) / yesterdayTxCount) * 100;
        const todayCashIn = Number(todayCashflow?._sum?.amount || 0);
        const yesterdayCashIn = Number(yesterdayCashflow?._sum?.amount || 0);
        const cashTrend = yesterdayCashIn === 0 ? 100 : ((todayCashIn - yesterdayCashIn) / yesterdayCashIn) * 100;
        const lowStockCount = await this.prisma.productVariant.count({ where: { stock: { lte: 10 }, product: { trackStock: true } } });

        return {
            sales: { value: todaySales, trend: `${salesTrend > 0 ? '+' : ''}${salesTrend.toFixed(1)}%`, trendUp: salesTrend >= 0 },
            transactions: { value: todayTxCount, trend: `${txTrend > 0 ? '+' : ''}${txTrend.toFixed(1)}%`, trendUp: txTrend >= 0 },
            cashflow: { value: todayCashIn, trend: `${cashTrend > 0 ? '+' : ''}${cashTrend.toFixed(1)}%`, trendUp: cashTrend >= 0 },
            alerts: { count: lowStockCount, items: lowStockItems.map(item => ({ name: `${item.product.name} ${item.size ? `(${item.size})` : ''}`.trim(), stock: item.stock, limit: 10 })) },
            salesChart,
        };
    }

    // ─── Edit Transaction Feature ───────────────────────────────────────────

    private async isAdminOrOwner(roleId: number | null): Promise<boolean> {
        if (!roleId) return false;
        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (!role) return false;
        const n = role.name.toLowerCase();
        return n === 'admin' || n === 'owner' || n === 'pemilik' || n.includes('manager') || n.includes('manajer') || n.includes('supervisor') || n.includes('kepala');
    }

    /** Generate and create a production job for a transaction item that requires production. */
    private async createProductionJobForItem(
        tx: any,
        transactionId: number,
        transactionItemId: number,
        priority: string,
        deadline: Date | null,
        notes: string | null,
        isSubOrder: boolean = false,
    ) {
        const jobDateStr = ymdLokal().replace(/-/g, ''); // tanggal WIB (dulu UTC)
        const jobPrefix = `JOB-${jobDateStr}-`;
        const lastJob = await tx.productionJob.findFirst({
            where: { jobNumber: { startsWith: jobPrefix } },
            orderBy: { jobNumber: 'desc' },
            select: { jobNumber: true },
        });
        const jobSeq = lastJob ? parseInt(lastJob.jobNumber.slice(jobPrefix.length), 10) + 1 : 1;
        // Route job ke productionBranchId (Titip Cetak) kalau di-set, fallback ke branchId transaksi.
        const txRouting = await tx.transaction.findUnique({
            where: { id: transactionId },
            select: { branchId: true, productionBranchId: true },
        });
        const jobBranchId = txRouting?.productionBranchId ?? txRouting?.branchId ?? null;
        await tx.productionJob.create({
            data: {
                jobNumber: `${jobPrefix}${String(jobSeq).padStart(4, '0')}`,
                transactionId,
                transactionItemId,
                status: 'ANTRIAN',
                priority: priority || 'NORMAL',
                deadline: deadline || null,
                notes: notes || null,
                isSubOrder,
                ...(jobBranchId != null ? { branchId: jobBranchId } : {}),
            },
        });
    }

    private async applyTransactionEdit(tx: any, transactionId: number, editData: TransactionEditData, actorUserId: number | null = null): Promise<void> {
        assertValidEditInput(editData);
        await this.lockTransactionRow(tx, transactionId);
        const transaction = await tx.transaction.findUniqueOrThrow({
            where: { id: transactionId },
            include: {
                items: {
                    include: {
                        productVariant: {
                            include: {
                                product: { include: { ingredients: true } },
                                variantIngredients: true,
                            }
                        }
                    }
                }
            }
        });

        if (!['PAID', 'PARTIAL', 'PENDING'].includes(transaction.status)) {
            throw new BadRequestException('Hanya transaksi PAID, PARTIAL, atau PENDING yang dapat diedit');
        }

        // Nilai satu baris menurut data tersimpan (dipakai utk item yang tidak berubah).
        const storedLine = (it: any): number => {
            if (it.widthCm === null) return Number(it.priceAtTime) * it.quantity;
            const mult = storedPriceMultiplier(it);
            return mult > 0 ? Number(it.priceAtTime) * mult * Math.max(1, Number(it.pcs) || 1) : Number(it.priceAtTime);
        };
        // Selisih nota lama = subtotal tersimpan − jumlah barisnya. Nota versi lama (pembulatan,
        // bug "item tambahan terhitung dua kali", dll.) bisa punya selisih ini; di produksi ada 53.
        // Dipertahankan supaya edit HANYA mengubah bagian yang memang diedit — dulu mengedit nama
        // pelanggan saja bisa mengubah Rp 50.000 jadi Rp 5 (T-08). Dibuang bila semua item lama dihapus.
        const legacyDelta = Number(transaction.totalAmount) - transaction.items.reduce((s: number, it: any) => s + storedLine(it), 0);

        // Multi-cabang: stok dipotong/restore di cabang PELAKSANA (productionBranchId) kalau titip cetak,
        // atau di cabang transaksi sendiri (branchId) kalau bukan titipan. WAJIB konsisten dengan
        // logic di _createTransaction (pakai stockBranchId = productionBranchId ?? branchId), kalau tidak
        // stok jadi inflasi di pemesan dan minus di pelaksana.
        const editTxBranchId: number | null =
            (transaction as any).productionBranchId ?? (transaction as any).branchId ?? null;

        let newSubtotal = 0;

        // ── HAPUS ITEM yang ditandai remove: true ──────────────────────────────
        const removeItems = editData.items.filter((e) => e.remove && e.id);
        for (const editItem of removeItems) {
            const txItem = transaction.items.find((i: any) => i.id === editItem.id);
            if (!txItem) continue;
            const variant = txItem.productVariant; // null = item custom
            const product = variant?.product;
            const pricingMode = product?.pricingMode || 'UNIT';
            // Kembalikan persis yang dulu dipotong checkout (sub order/custom/composite/produksi: tidak ada).
            const rules = this.stockRulesOf(product, Boolean((txItem as any).isSubOrder));
            const variantIngredients: any[] = rules.bom ? (variant?.variantIngredients || []) : [];
            const productIngredients: any[] = rules.bom ? (product?.ingredients || []) : [];

            if (rules.variant || rules.bom) {
                if (pricingMode === 'AREA_BASED') {
                    // Luas total = luas per lembar × pcs — sama dengan yang dipotong saat nota dibuat.
                    const areaM2 = txItem.areaCm2 ? (Number(txItem.areaCm2) / 10000) * Math.max(1, Number(txItem.pcs) || 1) : 0;
                    if (areaM2 > 0) {
                        await this._adjustStock(tx, editTxBranchId, variant.id, areaM2);
                        await this.logMovement(tx, variant.id, 'IN', areaM2, `Hapus Item Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                        for (const ing of productIngredients) {
                            if (ing.rawMaterialVariantId) {
                                const ret = Number(ing.quantity) * areaM2;
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Item (BOM) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            }
                        }
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const ret = Number(ing.quantity) * areaM2;
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Item (varian BOM) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            }
                        }
                    }
                } else {
                    const qty = txItem.quantity;
                    if (qty > 0) {
                        if (rules.variant) {
                            await this._adjustStock(tx, editTxBranchId, variant.id, qty);
                            await this.logMovement(tx, variant.id, 'IN', qty, `Hapus Item Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                        }
                        for (const ing of productIngredients) {
                            if (ing.rawMaterialVariantId) {
                                const ret = Number(ing.quantity) * qty;
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Item (BOM) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            }
                        }
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const ret = Number(ing.quantity) * qty;
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Item (varian BOM) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            }
                        }
                    }
                }
            }
            // Roll yang sudah dipotong operator (job sudah dimulai) dikembalikan — dulu hilang saat
            // item dibuang lewat edit, karena restore roll membaca job yang ikut terhapus di bawah.
            const jobLama: any = await tx.productionJob.findFirst({ where: { transactionItemId: txItem.id } });
            if (jobLama?.rollVariantId && Number(jobLama.rollLengthUsed) > 0) {
                const cabangRoll: number | null = jobLama.branchId ?? editTxBranchId;
                await this._adjustStock(tx, cabangRoll, jobLama.rollVariantId, Number(jobLama.rollLengthUsed));
                await this.logMovement(tx, jobLama.rollVariantId, 'IN', Number(jobLama.rollLengthUsed), `Hapus Item (roll) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, cabangRoll);
            }
            // Bahan pasang (rangka dll.) yang sudah dipotong saat "Mulai Pasang" dikembalikan juga
            // (hapus nota sudah begitu; hapus item lewat edit dulu melewatkannya).
            if (jobLama && (jobLama.status === 'PASANG' || jobLama.assemblyStartedAt || jobLama.assemblyCompletedAt) && txItem.productVariantId) {
                const pv: any = await tx.productVariant.findUnique({
                    where: { id: txItem.productVariantId },
                    select: { product: { select: { pricingMode: true, ingredients: { select: { rawMaterialVariantId: true, quantity: true } } } } },
                });
                if (pv?.product?.pricingMode === 'AREA_BASED') {
                    const cabangPasang: number | null = jobLama.branchId ?? editTxBranchId;
                    const jumlahPasang = Math.max(1, Number((txItem as any).pcs ?? 1) || 1) * Math.max(1, Number(txItem.quantity ?? 1) || 1);
                    for (const ing of pv.product.ingredients ?? []) {
                        if (!ing.rawMaterialVariantId) continue;
                        const ret = Number(ing.quantity) * jumlahPasang;
                        await this._adjustStock(tx, cabangPasang, ing.rawMaterialVariantId, ret);
                        await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Item (pasang BOM) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, cabangPasang);
                    }
                }
            }
            // Klik mesin item ini dibatalkan (bukan dibiarkan jadi biaya mesin tanpa nota).
            await tx.clickLog.updateMany({ where: { transactionItemId: txItem.id, voidedAt: null }, data: { voidedAt: new Date(), voidedById: actorUserId, voidReason: `Item dihapus dari nota ${transaction.invoiceNumber}` } });
            // Hapus ProductionJob dulu (FK constraint: productionJob.transactionItemId → transactionItem.id)
            await tx.productionJob.deleteMany({ where: { transactionItemId: txItem.id } });
            await tx.transactionItem.delete({ where: { id: txItem.id } });
        }

        // ── TAMBAH ITEM BARU ────────────────────────────────────────────────────
        const newItems = editData.items.filter((e) => !e.id && e.newVariantId && !e.remove);
        const addedIds = new Set<number>(); // item baru: sudah dijumlah di sini, jangan dijumlah lagi di bawah
        for (const editItem of newItems) {
            const variant = await tx.productVariant.findUnique({
                where: { id: editItem.newVariantId },
                include: { product: { include: { ingredients: true, clickRate: true } }, variantIngredients: true, priceTiers: { orderBy: { minQty: 'asc' } }, clickRate: true } as any,
            });
            if (!variant) throw new NotFoundException(`Variant ID ${editItem.newVariantId} tidak ditemukan`);
            const product = (variant as any).product;
            const pricingMode = product.pricingMode || 'UNIT';
            // Sama dengan checkout: produk AREA produksi tidak dipotong di sini (dipotong saat Mulai Job).
            const rules = this.stockRulesOf(product, false);
            const variantIngredients: any[] = rules.bom ? ((variant as any).variantIngredients || []) : [];
            const productIngredients: any[] = rules.bom ? (product.ingredients || []) : [];

            let lineTotal = 0;
            let unitResolvedPrice = 0; // per-unit price for UNIT mode (for priceAtTime storage)
            let overrideAreaPriceAtTime: number | null = null; // per-m² efektif kalau ada override area
            let newItemUnit: string | null = null;
            let widthCm: number | null = null;
            let heightCm: number | null = null;
            let areaCm2: number | null = null;
            let qty = editItem.quantity ?? 1;

            if (pricingMode === 'AREA_BASED') {
                const w = editItem.widthCm ?? 1;
                const h = editItem.heightCm ?? 1;
                const unit = normalizeUnit(editItem.unitType); // default 'cm', sama dgn nota baru (T-08)
                newItemUnit = unit;
                widthCm = w; heightCm = h;
                const { priceMultiplier, areaM2 } = areaFactors(unit, w, h);
                assertSaneArea(unit, w, h, areaM2, product.name);
                areaCm2 = areaM2 * 10000;
                const itemPcs = Math.max(1, editItem.pcs ?? 1);
                lineTotal = editItem.priceOverride != null ? editItem.priceOverride : priceMultiplier * Number(variant.price) * itemPcs;
                // Kalau ada override, simpan harga satuan efektif supaya nota (priceAtTime × pengali × pcs) = total.
                if (editItem.priceOverride != null && priceMultiplier > 0 && itemPcs > 0) {
                    overrideAreaPriceAtTime = editItem.priceOverride / (priceMultiplier * itemPcs);
                }

                // Stok dipotong untuk SEMUA lembar (luas × pcs), sama dengan nota baru.
                const areaStokM2 = areaM2 * itemPcs;
                if (rules.variant) {
                    await this._assertBranchStock(tx, editTxBranchId, variant.id, areaStokM2, product.name);
                    await this._adjustStock(tx, editTxBranchId, variant.id, -areaStokM2);
                    await this.logMovement(tx, variant.id, 'OUT', areaStokM2, `Tambah Item Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                    for (const ing of productIngredients) {
                        if (ing.rawMaterialVariantId) {
                            const needed = Number(ing.quantity) * areaStokM2;
                            await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -needed);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', needed, `Tambah Item (BOM) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                        }
                    }
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const needed = Number(ing.quantity) * areaStokM2;
                            await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -needed);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', needed, `Tambah Item (varian BOM) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                        }
                    }
                }
                qty = 1;
            } else {
                let resolvedPrice = Number(variant.price);
                const priceTiers: any[] = (variant as any).priceTiers || [];
                if (priceTiers.length > 0) {
                    const matched = [...priceTiers].sort((a: any, b: any) => b.minQty - a.minQty).find((t: any) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty));
                    if (matched) resolvedPrice = Number(matched.price);
                }
                if (editItem.priceOverride != null) resolvedPrice = editItem.priceOverride;
                lineTotal = resolvedPrice * qty;
                unitResolvedPrice = resolvedPrice; // capture per-unit price for priceAtTime storage

                if (rules.variant || rules.bom) {
                    if (rules.variant) {
                        await this._assertBranchStock(tx, editTxBranchId, variant.id, qty, product.name);
                        await this._adjustStock(tx, editTxBranchId, variant.id, -qty);
                        await this.logMovement(tx, variant.id, 'OUT', qty, `Tambah Item Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                    }
                    for (const ing of productIngredients) {
                        if (ing.rawMaterialVariantId) {
                            const needed = Number(ing.quantity) * qty;
                            await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -needed);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', needed, `Tambah Item (BOM) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                        }
                    }
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const needed = Number(ing.quantity) * qty;
                            await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -needed);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', needed, `Tambah Item (varian BOM) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                        }
                    }
                }
            }

            // Hitung HPP dari variantIngredients atau fallback ke variant.hpp
            let hppAtTime = Number(variant.hpp);
            if (variantIngredients.length > 0) {
                hppAtTime = variantIngredients.reduce((s: number, ing: any) => s + Number(ing.price) * Number(ing.quantity), 0);
            }

            // Store per-m² price for AREA_BASED, per-unit price for UNIT (consistent with original checkout).
            // Kalau override area, pakai per-m² efektif supaya nota menjumlah tepat.
            const itemPriceAtTime = overrideAreaPriceAtTime != null
                ? overrideAreaPriceAtTime
                : (pricingMode === 'AREA_BASED' ? Number(variant.price) : unitResolvedPrice);
            const newTxItem = await tx.transactionItem.create({
                data: {
                    transactionId, productVariantId: variant.id, quantity: qty, priceAtTime: itemPriceAtTime, hppAtTime, widthCm, heightCm, areaCm2,
                    unitType: pricingMode === 'AREA_BASED' ? newItemUnit : null, pcs: pricingMode === 'AREA_BASED' ? Math.max(1, editItem.pcs ?? 1) : 1,
                    ...(editItem.priceOverride != null ? { originalPrice: Number(variant.price), priceOverrideById: actorUserId } : {}),
                }
            });
            addedIds.add(newTxItem.id);

            // Create production job if product requires production
            if (product.requiresProduction) {
                await this.createProductionJobForItem(
                    tx, transactionId, newTxItem.id,
                    transaction.productionPriority || 'NORMAL',
                    transaction.productionDeadline || null,
                    transaction.productionNotes || null,
                );
            }

            // Item cetak kertas (bertarif klik): catatan klik + antrian /cetak seperti saat checkout.
            // Dulu item tambahan lewat edit tak muncul di papan cetak & kliknya tak tercatat
            // (rekonsiliasi mesin & hutang titipan kurang).
            const rate: any = (variant as any).clickRate ?? product.clickRate;
            if (rate?.isActive && Number(rate.pricePerClick) > 0) {
                const perUnit = Number((variant as any).clicksPerUnit ?? product.clicksPerUnit ?? 1) || 1;
                const banyak = pricingMode === 'AREA_BASED' ? Math.max(1, editItem.pcs ?? 1) : qty;
                const klik = Math.max(1, Math.round(banyak * perUnit));
                const cabangProduksi = (transaction as any).productionBranchId ?? (transaction as any).branchId ?? null;
                const kini = new Date();
                await (tx as any).clickLog.create({
                    data: {
                        clickRateId: rate.id, transactionItemId: newTxItem.id, quantity: klik,
                        pricePerClick: Number(rate.pricePerClick), totalCost: Number(rate.pricePerClick) * klik,
                        date: kini, branchId: cabangProduksi,
                    },
                });
                const prefix = `PRT-${ymdLokal(kini).replace(/-/g, '')}-`;
                const terakhir = await (tx as any).printJob.findFirst({ where: { jobNumber: { startsWith: prefix } }, orderBy: { jobNumber: 'desc' }, select: { jobNumber: true } });
                const n = terakhir?.jobNumber ? parseInt(terakhir.jobNumber.slice(prefix.length), 10) : 0;
                await (tx as any).printJob.create({
                    data: {
                        jobNumber: `${prefix}${String((Number.isNaN(n) ? 0 : n) + 1).padStart(4, '0')}`,
                        transactionId, transactionItemId: newTxItem.id, branchId: cabangProduksi,
                        quantity: qty, status: 'ANTRIAN', notes: 'Ditambahkan lewat edit nota',
                    },
                });
            }

            newSubtotal += lineTotal;
        }

        // Reload transaction items after removals/additions
        const updatedTransaction = await tx.transaction.findUniqueOrThrow({
            where: { id: transactionId },
            include: { items: { include: { productVariant: { include: { product: { include: { ingredients: true } }, variantIngredients: true } } } } }
        });

        // ── EDIT ITEM EXISTING ─────────────────────────────────────────────────
        const editExistingItems = editData.items.filter((e) => e.id && !e.remove);
        for (const editItem of editExistingItems) {
            const txItem = updatedTransaction.items.find((i: any) => i.id === editItem.id);
            if (!txItem) throw new NotFoundException(`Item ID ${editItem.id} tidak ditemukan di transaksi ini`);

            const variant = txItem.productVariant; // null = item custom (tanpa stok)
            const product = variant?.product;
            const pricingMode = product?.pricingMode || 'UNIT';
            // Sub order / custom / composite / AREA produksi tidak pernah memotong stok saat checkout
            // → koreksi qty/ukuran juga tidak menyentuh stok (dulu banner produksi ditolak "stok tidak cukup").
            const itemIsSub = Boolean((txItem as any).isSubOrder);
            const rules = this.stockRulesOf(product, itemIsSub);
            const variantIngredients: any[] = rules.bom ? (variant?.variantIngredients || []) : [];
            const productIngredients: any[] = rules.bom ? (product?.ingredients || []) : [];

            if (pricingMode === 'AREA_BASED') {
                const oldW = Number(txItem.widthCm);
                const oldH = Number(txItem.heightCm ?? 1);
                const oldPcs = Math.max(1, Number(txItem.pcs) || 1);
                const newW = editItem.widthCm ?? oldW;
                const newH = editItem.heightCm ?? oldH;
                // Satuan item lama TIDAK ikut diedit: selalu satuan tersimpan yang disimpulkan
                // dari datanya. Label lama bisa salah ('m' padahal isinya cm) dan modal edit
                // mengirim label itu balik → dulu total meledak ×10.000 (T-08). Kalau satuannya
                // memang salah, hapus item lalu tambah ulang.
                const unitType = storedUnit(txItem);
                const newPcs = Math.max(1, editItem.pcs ?? oldPcs);
                // Ukuran & pcs tidak berubah → pakai luas & pengali TERSIMPAN persis (data lama bisa
                // sedikit berbeda dari ukuran×ukuran), jadi baris ini tidak bergeser sepeser pun.
                const unchanged = Math.abs(newW - oldW) < 1e-9 && Math.abs(newH - oldH) < 1e-9 && newPcs === oldPcs;
                let newPriceMultiplier: number;
                let newAreaM2: number;
                if (unchanged) {
                    newPriceMultiplier = storedPriceMultiplier(txItem);
                    newAreaM2 = (Number(txItem.areaCm2) || 0) / 10000;
                } else {
                    ({ priceMultiplier: newPriceMultiplier, areaM2: newAreaM2 } = areaFactors(unitType, newW, newH));
                    assertSaneArea(unitType, newW, newH, newAreaM2, product.name);
                }

                const newAreaCm2 = newAreaM2 * 10000;
                const oldAreaM2 = txItem.areaCm2 ? Number(txItem.areaCm2) / 10000 : 0;
                // Selisih luas TOTAL (per lembar × pcs) — dulu pcs diabaikan, stok tidak ikut berubah saat pcs diedit.
                const areaDelta = newAreaM2 * newPcs - oldAreaM2 * oldPcs;

                if (rules.variant && Math.abs(areaDelta) > 0.0001) {
                    // delta positif = area bertambah → kurangi stok; delta negatif = area berkurang → kembalikan stok.
                    if (areaDelta > 0) {
                        await this._assertBranchStock(tx, editTxBranchId, variant.id, areaDelta, product.name);
                        await this._adjustStock(tx, editTxBranchId, variant.id, -areaDelta);
                        await this.logMovement(tx, variant.id, 'OUT', areaDelta, `Koreksi Edit Transaksi ${transaction.invoiceNumber} (area bertambah)`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                    } else {
                        const returnM2 = Math.abs(areaDelta);
                        await this._adjustStock(tx, editTxBranchId, variant.id, returnM2);
                        await this.logMovement(tx, variant.id, 'IN', returnM2, `Koreksi Edit Transaksi ${transaction.invoiceNumber} (area berkurang)`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                    }

                    // Adjust product-level BOM (AREA_BASED)
                    for (const ing of productIngredients) {
                        if (ing.rawMaterialVariantId) {
                            const ingDelta = Number(ing.quantity) * areaDelta;
                            if (ingDelta > 0) {
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -ingDelta);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', ingDelta, `Koreksi Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            } else if (ingDelta < 0) {
                                const ret = Math.abs(ingDelta);
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Koreksi Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            }
                        }
                    }

                    // Adjust variant-level BOM (AREA_BASED)
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const ingDelta = Number(ing.quantity) * areaDelta;
                            if (ingDelta > 0) {
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -ingDelta);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', ingDelta, `Koreksi (varian) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            } else if (ingDelta < 0) {
                                const ret = Math.abs(ingDelta);
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Koreksi (varian) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            }
                        }
                    }
                }

                // Harga satuan = harga SAAT NOTA DIBUAT (priceAtTime), bukan harga katalog hari ini —
                // sama dengan item UNIT. Dulu harga katalog dipakai, sehingga mengedit nama pelanggan
                // saja bisa mengubah total bila harga/tier/harga nego berbeda.
                let storedPriceAtTime = Number(txItem.priceAtTime);
                let newLineTotal = storedPriceAtTime * newPriceMultiplier * newPcs;
                if (editItem.priceOverride != null) {
                    newLineTotal = editItem.priceOverride;
                    // Harga satuan efektif supaya nota (priceAtTime × pengali × pcs) = total.
                    if (newPriceMultiplier > 0 && newPcs > 0) storedPriceAtTime = editItem.priceOverride / (newPriceMultiplier * newPcs);
                }

                const jejakArea = editItem.priceOverride != null && Math.abs(storedPriceAtTime - Number(txItem.priceAtTime)) > 0.005
                    ? { originalPrice: txItem.originalPrice ?? txItem.priceAtTime, priceOverrideById: actorUserId }
                    : {};
                await tx.transactionItem.update({
                    where: { id: txItem.id },
                    data: { widthCm: newW, heightCm: newH, areaCm2: newAreaCm2, unitType, priceAtTime: storedPriceAtTime, pcs: newPcs, ...jejakArea }
                });

                // Recreate production job if product requires production (old job may have been deleted or was missing)
                if (product.requiresProduction) {
                    const existingJob = await tx.productionJob.findFirst({ where: { transactionItemId: txItem.id }, select: { id: true, status: true } });
                    // Only recreate if job is missing or still in ANTRIAN (not started)
                    if (!existingJob || existingJob.status === 'ANTRIAN') {
                        await tx.productionJob.deleteMany({ where: { transactionItemId: txItem.id } });
                        await this.createProductionJobForItem(
                            tx, transactionId, txItem.id,
                            transaction.productionPriority || 'NORMAL',
                            transaction.productionDeadline || null,
                            transaction.productionNotes || null,
                            itemIsSub,
                        );
                    }
                }

                newSubtotal += newLineTotal;

            } else {
                // UNIT mode
                const newQty = editItem.quantity ?? txItem.quantity;
                if (newQty < 1) throw new BadRequestException(`Jumlah item minimal 1`);
                const delta = newQty - txItem.quantity;

                if (delta !== 0 && (rules.variant || rules.bom)) {
                    if (rules.variant && delta > 0) {
                        await this._assertBranchStock(tx, editTxBranchId, variant.id, delta, product.name);
                        await this._adjustStock(tx, editTxBranchId, variant.id, -delta);
                        await this.logMovement(tx, variant.id, 'OUT', delta, `Koreksi Edit Transaksi ${transaction.invoiceNumber} (qty bertambah)`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                    } else if (rules.variant) {
                        const returnQty = Math.abs(delta);
                        await this._adjustStock(tx, editTxBranchId, variant.id, returnQty);
                        await this.logMovement(tx, variant.id, 'IN', returnQty, `Koreksi Edit Transaksi ${transaction.invoiceNumber} (qty berkurang)`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                    }

                    // Adjust product-level BOM (UNIT)
                    for (const ing of productIngredients) {
                        if (ing.rawMaterialVariantId) {
                            const ingDelta = Number(ing.quantity) * delta;
                            if (ingDelta > 0) {
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -ingDelta);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', ingDelta, `Koreksi Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            } else if (ingDelta < 0) {
                                const ret = Math.abs(ingDelta);
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Koreksi Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            }
                        }
                    }

                    // Adjust variant-level BOM (UNIT)
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const ingDelta = Number(ing.quantity) * delta;
                            if (ingDelta > 0) {
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -ingDelta);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', ingDelta, `Koreksi (varian) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            } else if (ingDelta < 0) {
                                const ret = Math.abs(ingDelta);
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Koreksi (varian) Edit Transaksi ${transaction.invoiceNumber}`, `tx-${transaction.invoiceNumber}`, editTxBranchId);
                            }
                        }
                    }
                }

                // Price override untuk UNIT mode
                const resolvedPrice = editItem.priceOverride != null ? editItem.priceOverride : Number(txItem.priceAtTime);
                // Jejak harga manual (T-32): simpan harga sebelum diubah (sekali — yang paling awal).
                const jejakUnit = editItem.priceOverride != null && Math.abs(resolvedPrice - Number(txItem.priceAtTime)) > 0.005
                    ? { originalPrice: txItem.originalPrice ?? txItem.priceAtTime, priceOverrideById: actorUserId }
                    : {};
                await tx.transactionItem.update({ where: { id: txItem.id }, data: { quantity: newQty, priceAtTime: resolvedPrice, ...jejakUnit } });

                // Recreate production job for UNIT items if requires production
                if (product.requiresProduction) {
                    const existingJob = await tx.productionJob.findFirst({ where: { transactionItemId: txItem.id }, select: { id: true, status: true } });
                    if (!existingJob || existingJob.status === 'ANTRIAN') {
                        await tx.productionJob.deleteMany({ where: { transactionItemId: txItem.id } });
                        await this.createProductionJobForItem(
                            tx, transactionId, txItem.id,
                            transaction.productionPriority || 'NORMAL',
                            transaction.productionDeadline || null,
                            transaction.productionNotes || null,
                            itemIsSub,
                        );
                    }
                }

                newSubtotal += resolvedPrice * newQty;
            }
        }

        // Items NOT in editData (not removed, not edited) keep their existing subtotals
        const removedIds = new Set(removeItems.map((e) => e.id));
        const editedIds = new Set(editExistingItems.map((e) => e.id));
        for (const existingItem of updatedTransaction.items) {
            // Item baru sudah dijumlah saat dibuat — dulu terhitung DUA KALI (tambah item
            // Rp 5.500 lewat edit → total naik Rp 11.000).
            if (removedIds.has(existingItem.id) || editedIds.has(existingItem.id) || addedIds.has(existingItem.id)) continue;
            // AREA_BASED: priceAtTime × pengali tersimpan × pcs (per cm² → area_cm2, lainnya → m²).
            newSubtotal += storedLine(existingItem);
        }

        const semuaItemLamaDihapus = transaction.items.length > 0 && transaction.items.every((it: any) => removedIds.has(it.id));
        if (Math.abs(legacyDelta) >= 0.01 && !semuaItemLamaDihapus) newSubtotal += legacyDelta;

        newSubtotal = Math.round(newSubtotal); // rupiah tanpa sen (T-20)
        const discountAmount = Math.round(editData.discount !== undefined ? Number(editData.discount) : Number(transaction.discount));
        if (!Number.isFinite(discountAmount) || discountAmount < 0) throw new BadRequestException('Diskon tidak boleh negatif.');
        if (discountAmount > newSubtotal) {
            throw new BadRequestException(`Diskon Rp ${discountAmount.toLocaleString('id-ID')} melebihi subtotal Rp ${newSubtotal.toLocaleString('id-ID')} — nota tidak boleh bernilai minus.`);
        }
        const amountAfterDiscount = newSubtotal - discountAmount;
        // Pajak mengikuti tarif nota ini sendiri (saat dibuat), bukan setelan toko hari ini:
        // nota tanpa pajak tetap tanpa pajak walau pajak baru diaktifkan.
        const origBase = Number(transaction.totalAmount) - Number(transaction.discount);
        const origTax = Number(transaction.tax) || 0;
        const taxAmount = origTax > 0 && origBase > 0 ? Math.round(amountAfterDiscount * (origTax / origBase)) : 0;
        // Ongkir ikut dijumlahkan seperti saat nota dibuat (dulu hilang saat nota diedit).
        const newGrandTotal = amountAfterDiscount + taxAmount + (Number(transaction.shippingCost) || 0);
        // Nota belum lunas tidak boleh bernilai di bawah uang yang sudah diterima — kelebihannya
        // tidak tercatat di mana pun (dulu lolos, lalu "Lunasi" mencatat Rp 0).
        const sudahDibayar = Number(transaction.downPayment) || 0;
        if (transaction.status !== 'PAID' && newGrandTotal < sudahDibayar - 0.5) {
            throw new BadRequestException(`Total baru Rp ${newGrandTotal.toLocaleString('id-ID')} lebih kecil dari uang yang sudah diterima (Rp ${sudahDibayar.toLocaleString('id-ID')}). Kurangi pembayaran dulu atau batalkan edit.`);
        }

        await tx.transaction.update({
            where: { id: transactionId },
            data: {
                totalAmount: newSubtotal,
                discount: discountAmount,
                tax: taxAmount,
                grandTotal: newGrandTotal,
                customerName: editData.customerName !== undefined ? satuBaris(editData.customerName, 150) : transaction.customerName,
                customerPhone: editData.customerPhone !== undefined ? satuBaris(editData.customerPhone, 30) : transaction.customerPhone,
                customerAddress: editData.customerAddress !== undefined ? editData.customerAddress : transaction.customerAddress,
                label: editData.label !== undefined
                    ? ((editData.label || '').replace(/\s+/g, ' ').trim().slice(0, 120) || null)
                    : (transaction as any).label,
            }
        });

        // Nota LUNAS: pemasukan dikoreksi sebesar SELISIH total, pada pembayaran terakhir.
        // Dulu semua baris pemasukan (DP + pelunasan) ditimpa dengan total baru → nota DP yang
        // diedit (bahkan hanya ganti nama) tercatat masuk dua kali lipat.
        if (transaction.status === 'PAID') {
            let selisih = Math.round((newGrandTotal - Number(transaction.grandTotal)) * 100) / 100;
            if (Math.abs(selisih) >= 0.01) {
                const baris = await this.cashflowsOfInvoice(tx, transaction.invoiceNumber, { type: CashflowType.INCOME });
                for (const cf of baris) {
                    if (Math.abs(selisih) < 0.01) break;
                    const lama = Number(cf.amount);
                    const baru = Math.max(0, lama + selisih);
                    selisih -= baru - lama;
                    await tx.cashflow.update({ where: { id: cf.id }, data: { amount: baru } });
                }
            }
        }
    }

    async editTransactionDirect(id: number, roleId: number | null, editData: TransactionEditData, branchCtx?: BranchContext, actorUserId: number | null = null) {
        // Transaksi PENDING (draft invoice) boleh diedit siapa saja — belum ada pembayaran
        const transaction = await this.prisma.transaction.findUnique({ where: { id } });
        if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');
        assertBranchAccess(branchCtx ?? { isOwner: true, branchId: null, userBranchId: null, roleName: null }, (transaction as any).branchId ?? null);
        const isPending = transaction.status === TransactionStatus.PENDING;
        if (!isPending && !(await this.isAdminOrOwner(roleId))) {
            throw new ForbiddenException('Hanya Admin/Owner yang dapat mengedit transaksi yang sudah terbayar');
        }
        const hasil = await this.prisma.$transaction(async (tx) => {
            await this.applyTransactionEdit(tx, id, editData, actorUserId);
            return tx.transaction.findUniqueOrThrow({
                where: { id },
                include: { items: { include: { productVariant: { include: { product: true } } } } }
            });
        });
        await this._perbaruiTitipanLedger(id).catch((e) => this.logger.error(`Hitung ulang hutang titipan nota #${id} gagal: ${(e as Error).message}`));
        return hasil;
    }

    async createEditRequest(transactionId: number, requestedById: number, reason: string, editData: TransactionEditData, branchCtx?: BranchContext) {
        const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
        if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');
        assertBranchAccess(branchCtx ?? { isOwner: true, branchId: null, userBranchId: null, roleName: null }, (transaction as any).branchId ?? null);
        if (!['PAID', 'PARTIAL', 'PENDING'].includes(transaction.status)) {
            throw new BadRequestException('Hanya transaksi PAID, PARTIAL, atau PENDING yang dapat diedit');
        }

        const existing = await (this.prisma as any).transactionEditRequest.findFirst({
            where: { transactionId, status: 'PENDING' }
        });
        if (existing) throw new BadRequestException('Sudah ada permintaan edit yang menunggu untuk transaksi ini');

        const requester = await this.prisma.user.findUnique({ where: { id: requestedById }, select: { name: true } });

        const request = await (this.prisma as any).transactionEditRequest.create({
            data: { transactionId, requestedById, reason, editData: editData as any, status: 'PENDING' }
        });

        this.notificationsService.emit({
            type: 'system',
            title: 'Permintaan Edit Transaksi',
            message: `${requester?.name || 'Kasir'} meminta edit transaksi ${transaction.invoiceNumber}`,
        });

        return request;
    }

    async getEditRequests(status?: string, branchCtx?: BranchContext) {
        // Staf/manajer cabang hanya melihat permintaan atas nota cabangnya.
        const cabang = branchCtx && !branchCtx.isOwner ? { transaction: { branchId: branchCtx.userBranchId ?? -1 } } : {};
        const rows: any[] = await (this.prisma as any).transactionEditRequest.findMany({
            where: { ...(status ? { status } : {}), ...cabang },
            orderBy: { createdAt: 'desc' },
            include: {
                transaction: { select: { id: true, invoiceNumber: true, grandTotal: true, discount: true, customerName: true, customerPhone: true, status: true, items: { include: { productVariant: { include: { product: true } } } } } },
                requestedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
            }
        });
        // Nama varian untuk item BARU di permintaan (layar persetujuan dulu tak menampilkannya).
        const ids = [...new Set(rows.flatMap((r) => ((r.editData?.items ?? []) as any[]).map((i) => Number(i.newVariantId)).filter((n) => n > 0)))];
        const varian = ids.length ? await this.prisma.productVariant.findMany({ where: { id: { in: ids } }, select: { id: true, variantName: true, product: { select: { name: true } } } }) : [];
        const nama = Object.fromEntries(varian.map((v: any) => [v.id, v.variantName ? `${v.product?.name} — ${v.variantName}` : v.product?.name]));
        return rows.map((r) => ({ ...r, newVariantNames: nama }));
    }

    async reviewEditRequest(requestId: number, reviewerId: number, reviewerRoleId: number | null, approved: boolean, reviewNote?: string) {
        if (!(await this.isAdminOrOwner(reviewerRoleId))) {
            throw new ForbiddenException('Hanya Admin/Owner yang dapat mereview permintaan edit');
        }

        const req = await (this.prisma as any).transactionEditRequest.findUnique({ where: { id: requestId } });
        if (!req) throw new NotFoundException('Permintaan edit tidak ditemukan');
        if (req.status !== 'PENDING') throw new BadRequestException('Permintaan ini sudah diproses');

        if (approved) {
            await this.prisma.$transaction(async (tx) => {
                // Klaim dulu: dua admin / klik ganda tidak boleh menerapkan edit dua kali.
                const klaim = await (tx as any).transactionEditRequest.updateMany({
                    where: { id: requestId, status: 'PENDING' },
                    data: { status: 'APPROVED', reviewedById: reviewerId, reviewNote: reviewNote || null }
                });
                if (klaim.count !== 1) throw new BadRequestException('Permintaan ini sudah diproses');
                await this.applyTransactionEdit(tx, req.transactionId, req.editData as TransactionEditData, req.requestedById ?? null);
            });
            await this._perbaruiTitipanLedger(req.transactionId).catch((e) => this.logger.error(`Hitung ulang hutang titipan nota #${req.transactionId} gagal: ${(e as Error).message}`));
            this.notificationsService.emit({
                type: 'system',
                title: 'Permintaan Edit Disetujui',
                message: `Perubahan transaksi telah diterapkan.${reviewNote ? ` Catatan: ${reviewNote}` : ''}`,
            });
        } else {
            const klaim = await (this.prisma as any).transactionEditRequest.updateMany({
                where: { id: requestId, status: 'PENDING' },
                data: { status: 'REJECTED', reviewedById: reviewerId, reviewNote: reviewNote || null }
            });
            if (klaim.count !== 1) throw new BadRequestException('Permintaan ini sudah diproses');
            this.notificationsService.emit({
                type: 'system',
                title: 'Permintaan Edit Ditolak',
                message: `Permintaan ditolak.${reviewNote ? ` Alasan: ${reviewNote}` : ''}`,
            });
        }

        return (this.prisma as any).transactionEditRequest.findUnique({
            where: { id: requestId },
            include: {
                transaction: { select: { id: true, invoiceNumber: true } },
                requestedBy: { select: { id: true, name: true, email: true } },
            }
        });
    }

    // ─── Delete Transaction ──────────────────────────────────────────────────

    async deleteTransaction(id: number, roleId: number | null, branchCtx?: BranchContext) {
        if (!(await this.isAdminOrOwner(roleId))) {
            throw new ForbiddenException('Hanya Admin/Owner yang dapat menghapus transaksi');
        }
        await this.assertTxBranchAccess(id, branchCtx);
        return this.prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.findUnique({
                where: { id },
                include: {
                    items: {
                        include: {
                            productVariant: {
                                include: {
                                    product: { include: { ingredients: true } },
                                    variantIngredients: true,
                                }
                            },
                            productionJob: true, // perlu untuk restore stok roll jika sudah dimulai
                        }
                    },
                    branch: { select: { id: true, name: true, code: true } } as any,
                    productionBranch: { select: { id: true, name: true, code: true } } as any,
                } as any
            });
            if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');
            // Titipan yang sudah dilunasi antar cabang: kas/stok pelunasan tercatat di dua cabang dan
            // ikut terhapus (cascade) tanpa dibalik → saldo kedua cabang meleset. Tolak dulu.
            const pelunasan: any[] = await tx.$queryRaw`SELECT COUNT(*) AS n FROM ledger_settlements ls JOIN inter_branch_ledger l ON l.id = ls.ledger_id WHERE l.transaction_id = ${id}`;
            if (Number(pelunasan[0]?.n ?? 0) > 0) {
                throw new BadRequestException('Titipan nota ini sudah dilunasi antar cabang, jadi nota tidak bisa dihapus. Catat koreksinya lewat menu Kas.');
            }

            // Snapshot context untuk reason text — dipakai biar movement tetap informatif setelah transaksi dihapus.
            // Format: "Hapus Transaksi SO-XXX | Asita | Titipan BTL → PST"
            const _ctxParts: string[] = [];
            const _customerName = (transaction as any).customerName;
            if (_customerName) _ctxParts.push(_customerName);
            const _ownerBranch = (transaction as any).branch;
            const _prodBranch = (transaction as any).productionBranch;
            const _isTitipan = (transaction as any).productionBranchId != null
                && (transaction as any).productionBranchId !== (transaction as any).branchId;
            if (_isTitipan) {
                const fromCode = _ownerBranch?.code || _ownerBranch?.name || '?';
                const toCode = _prodBranch?.code || _prodBranch?.name || '?';
                _ctxParts.push(`Titipan ${fromCode} → ${toCode}`);
            } else if (_ownerBranch) {
                _ctxParts.push(`Cabang ${_ownerBranch.code || _ownerBranch.name}`);
            }
            const _delCtx = _ctxParts.length ? ` | ${_ctxParts.join(' | ')}` : '';

            // Restore stok ke cabang yang dulu DIPOTONG: pelaksana (productionBranchId) kalau titip cetak,
            // atau cabang transaksi sendiri kalau bukan. Konsisten dengan stockBranchId di _createTransaction.
            // Kalau dipakai branchId saja, untuk titip cetak akan inflasi pemesan & minus pelaksana.
            const txBranchId: number | null =
                (transaction as any).productionBranchId ?? (transaction as any).branchId ?? null;
            // eslint-disable-next-line no-console
            const _items: any[] = (transaction as any).items ?? [];
            console.log(`[DELETE-TX] ${transaction.invoiceNumber} branchId=${txBranchId} items=${_items.length}`);
            for (const txItem of _items) {
                const variant = txItem.productVariant;
                // Item custom (tanpa varian) tidak pernah memotong stok — dulu di sini error dan
                // nota berisi item custom tidak bisa dihapus.
                if (!variant) continue;
                const product = (variant as any).product;
                const pricingMode = product.pricingMode || 'UNIT';
                const trackStock = product.trackStock !== false;
                // Kembalikan persis yang dipotong checkout: sub order & COMPOSITE tidak memotong apa pun.
                const rules = this.stockRulesOf(product, Boolean((txItem as any).isSubOrder));
                const variantIngredients: any[] = rules.bom ? ((variant as any).variantIngredients || []) : [];
                const productIngredients: any[] = rules.bom ? (product.ingredients || []) : [];
                const requiresProduction = product.requiresProduction === true;
                const jobInfo: any = (txItem as any).productionJob;
                // eslint-disable-next-line no-console
                console.log(`  item#${txItem.id} variant=${variant.id} ${product.name} mode=${pricingMode} requiresProd=${requiresProduction} trackStock=${trackStock} qty=${txItem.quantity} areaCm2=${txItem.areaCm2 ?? 'n/a'} pcs=${(txItem as any).pcs ?? 'n/a'} jobStatus=${jobInfo?.status ?? 'no-job'} rollLengthUsed=${jobInfo?.rollLengthUsed ?? 'null'} jobBranch=${jobInfo?.branchId ?? 'null'}`);

                if (pricingMode === 'AREA_BASED') {
                    if (requiresProduction) {
                        // Stok produk TIDAK dipotong saat create (dipotong operator saat startJob).
                        // Tapi jika job sudah dimulai (status PROSES/dst), roll/bahan sudah dipotong — kembalikan.
                        const job: any = (txItem as any).productionJob;
                        if (job && job.rollVariantId && job.rollLengthUsed) {
                            const rollArea = Number(job.rollLengthUsed);
                            if (rollArea > 0) {
                                // Prioritaskan branchId dari job (pemotongan stok terjadi di startJob per-cabang).
                                // Fallback ke branchId transaksi jika job belum punya (data lama).
                                const restoreBranchId: number | null = (job as any).branchId ?? txBranchId;
                                await this._adjustStock(tx, restoreBranchId, job.rollVariantId, rollArea);
                                await this.logMovement(tx, job.rollVariantId, 'IN', rollArea, `Hapus Transaksi (roll) ${transaction.invoiceNumber}${_delCtx}`, `tx-${transaction.invoiceNumber}`, restoreBranchId);
                            }
                        }
                        // Kalau assembly sudah dilakukan (job.status pernah PASANG/SELESAI-assembly), BOM rangka juga
                        // sudah dipotong di startAssembly — kembalikan.
                        if (job && (job.status === 'PASANG' || job.assemblyStartedAt || job.assemblyCompletedAt)) {
                            const restoreBranchId: number | null = (job as any).branchId ?? txBranchId;
                            // BOM pasang dipotong di startAssembly (bukan checkout) → pakai BOM produk langsung.
                            const jumlahPasang = Math.max(1, Number((txItem as any).pcs ?? 1) || 1) * Math.max(1, Number(txItem.quantity ?? 1) || 1);
                            for (const ing of (product.ingredients || [])) {
                                if (ing.rawMaterialVariantId) {
                                    const ret = Number(ing.quantity) * jumlahPasang; // sama dgn yang dipotong saat Mulai Pasang
                                    await this._adjustStock(tx, restoreBranchId, ing.rawMaterialVariantId, ret);
                                    await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (pasang BOM) ${transaction.invoiceNumber}${_delCtx}`, `tx-${transaction.invoiceNumber}`, restoreBranchId);
                                }
                            }
                        }
                        continue;
                    }

                    if (!rules.variant) continue;

                    // Bug fix: kalikan kembali dengan pcs × quantity (sama persis dengan yang dipotong saat create)
                    const pcs = Number((txItem as any).pcs ?? 1);
                    const itemQty = Number(txItem.quantity ?? 1);
                    const areaM2 = txItem.areaCm2 ? (Number(txItem.areaCm2) / 10000) * pcs * itemQty : 0;
                    if (areaM2 > 0) {
                        // eslint-disable-next-line no-console
                        console.log(`    → restore AREA_BASED variant=${variant.id} +${areaM2}m² to branch=${txBranchId}`);
                        await this._adjustStock(tx, txBranchId, variant.id, areaM2);
                        await this.logMovement(tx, variant.id, 'IN', areaM2, `Hapus Transaksi ${transaction.invoiceNumber}${_delCtx}`, `tx-${transaction.invoiceNumber}`, txBranchId);
                        for (const ing of productIngredients) {
                            if (ing.rawMaterialVariantId) {
                                const ret = Number(ing.quantity) * areaM2;
                                await this._adjustStock(tx, txBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (BOM) ${transaction.invoiceNumber}${_delCtx}`, `tx-${transaction.invoiceNumber}`, txBranchId);
                            }
                        }
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const ret = Number(ing.quantity) * areaM2;
                                await this._adjustStock(tx, txBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (varian BOM) ${transaction.invoiceNumber}${_delCtx}`, `tx-${transaction.invoiceNumber}`, txBranchId);
                            }
                        }
                    }
                } else {
                    // UNIT products
                    // PENTING: BOM (ingredients) selalu dipotong saat create (lihat _createTransaction
                    // UNIT branch: pemotongan BOM berada DI LUAR guard trackStock). Jadi BOM wajib
                    // dikembalikan saat hapus, meski produk induk trackStock=false.
                    const qty = Number(txItem.quantity);
                    if (qty > 0) {
                        // eslint-disable-next-line no-console
                        console.log(`    → restore UNIT variant=${variant.id} +${qty} to branch=${txBranchId} (trackStock=${trackStock}, BOM item count=${productIngredients.length + variantIngredients.length})`);

                        // Kembalikan stok produk induk HANYA kalau dulu dipotong (trackStock, bukan sub order/composite)
                        if (rules.variant) {
                            await this._adjustStock(tx, txBranchId, variant.id, qty);
                            await this.logMovement(tx, variant.id, 'IN', qty, `Hapus Transaksi ${transaction.invoiceNumber}${_delCtx}`, `tx-${transaction.invoiceNumber}`, txBranchId);
                        }

                        // BOM selalu dikembalikan (terlepas dari trackStock induk)
                        for (const ing of productIngredients) {
                            if (ing.rawMaterialVariantId) {
                                const ret = Number(ing.quantity) * qty;
                                // eslint-disable-next-line no-console
                                console.log(`      ↳ BOM restore raw=${ing.rawMaterialVariantId} +${ret}`);
                                await this._adjustStock(tx, txBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (BOM) ${transaction.invoiceNumber}${_delCtx}`, `tx-${transaction.invoiceNumber}`, txBranchId);
                            }
                        }
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const ret = Number(ing.quantity) * qty;
                                // eslint-disable-next-line no-console
                                console.log(`      ↳ varian-BOM restore raw=${ing.rawMaterialVariantId} +${ret}`);
                                await this._adjustStock(tx, txBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (varian BOM) ${transaction.invoiceNumber}${_delCtx}`, `tx-${transaction.invoiceNumber}`, txBranchId);
                            }
                        }
                    }
                }
            }

            // Hapus cashflow nota ini saja (INV-…-100 tidak boleh ikut menghapus kas INV-…-1000).
            const kasNota = await this.cashflowsOfInvoice(tx, transaction.invoiceNumber, {});
            if (kasNota.length) await tx.cashflow.deleteMany({ where: { id: { in: kasNota.map((c) => c.id) } } });

            // Hapus ProductionJob untuk semua item (FK tanpa onDelete Cascade)
            const itemIds = _items.map((i: any) => i.id);
            if (itemIds.length > 0) {
                // Klik mesin nota ini dibatalkan — dulu tertinggal tanpa nota & tetap dihitung biaya mesin.
                await (tx as any).clickLog.updateMany({ where: { transactionItemId: { in: itemIds }, voidedAt: null }, data: { voidedAt: new Date(), voidReason: `Nota ${transaction.invoiceNumber} dihapus` } });
                await (tx as any).productionJob.deleteMany({ where: { transactionItemId: { in: itemIds } } });
            }
            // Permintaan edit atas nota ini ikut dihapus — dulu relasinya menahan hapus nota
            // ("masih dipakai data lain").
            await (tx as any).transactionEditRequest.deleteMany({ where: { transactionId: id } });

            // Lead yang closing lewat nota ini dibuka lagi: dulu tetap CLOSED_WON menunjuk nota yang
            // sudah tiada, lalu KPI/bonus CS memakai estimatedValue-nya seolah tetap terjual.
            await (tx as any).lead.updateMany({ where: { convertedTransactionId: id, status: 'CLOSED_WON' }, data: { status: 'NEGOTIATION', convertedTransactionId: null } });
            await (tx as any).lead.updateMany({ where: { convertedTransactionId: id }, data: { convertedTransactionId: null } });

            // Hapus transaksi (cascade hapus items)
            await tx.transaction.delete({ where: { id } });

            return { success: true, invoiceNumber: transaction.invoiceNumber };
        });
    }
}
