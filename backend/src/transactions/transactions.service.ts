import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, TransactionStatus, CashflowType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { BranchContext } from '../common/branch-context.decorator';
import { branchWhere } from '../common/branch-where.helper';

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
};

@Injectable()
export class TransactionsService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
    ) { }

    // Helper: buat StockMovement dengan balanceAfter otomatis dari stok variant saat ini (post-update)
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
        const bs = await (tx as any).branchStock.findUnique({
            where: {
                branchId_productVariantId: { branchId, productVariantId: variantId },
            },
            select: { stock: true },
        });
        const have = Number(bs?.stock ?? 0);
        if (have < needed) {
            throw new BadRequestException(
                `Stok ${productName} di cabang ini tidak cukup. Tersedia: ${have}, dibutuhkan: ${needed}.`,
            );
        }
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

        // Update cache global di ProductVariant.stock
        const cur = await tx.productVariant.findUnique({
            where: { id: variantId },
            select: { stock: true },
        });
        const newGlobal = Math.floor((Number(cur?.stock ?? 0) + rounded) * 100) / 100;
        await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: newGlobal },
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
            productVariantId: number;
            quantity: number;
            widthCm?: number;
            heightCm?: number;
            unitType?: string;
            note?: string;
            customPrice?: number;
        }[];
        paymentMethod: PaymentMethod;
        discount?: number;
        shippingCost?: number;
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
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
            productVariantId: number;
            quantity: number;
            widthCm?: number;
            heightCm?: number;
            unitType?: string;
            pcs?: number;
            note?: string;
            customPrice?: number;
        }[];
        paymentMethod: PaymentMethod;
        discount?: number;
        shippingCost?: number;
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        dueDate?: string;
        downPayment?: number;
        cashierName?: string;
        employeeName?: string;
        bankAccountId?: number;
        productionPriority?: string;
        productionDeadline?: string;
        productionNotes?: string;
        transactionDate?: string;
        cashflowDate?: string;
        saveOnly?: boolean;
        salesOrderId?: number;
        branchName?: string;   // DEPRECATED — pakai branchId
        branchId?: number | null;  // cabang sumber (multi-cabang)
        productionBranchId?: number | null; // Titip cetak ke cabang lain. null = sama dengan branchId.
    }) {
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
            const settings = await tx.storeSettings.findFirst();
            const enableTax = settings?.enableTax ?? true;
            const taxRate = settings?.taxRate ? Number(settings.taxRate) : 10;

            let subtotal = 0;
            const transactionItemsData: any[] = [];

            for (const item of data.items) {
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
                    const matchedTier = priceTiers.find((t: any) =>
                        item.quantity >= t.minQty && (t.maxQty === null || item.quantity <= t.maxQty)
                    );
                    if (matchedTier) resolvedPrice = Number(matchedTier.price);
                }
                // Admin custom price override for UNIT mode
                if (pricingMode === 'UNIT' && item.customPrice != null) {
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
                    // Area-based calculation depending on unitType
                    if (item.widthCm === undefined) {
                        throw new BadRequestException(`Nilai / Dimensi cetak wajib diisi untuk produk area: ${variant.product.name}`);
                    }
                    widthCm = item.widthCm;
                    heightCm = item.heightCm || 1;

                    // priceMultiplier: raw area in input unit (for price calculation)
                    // areaM2: always in m² (for stock deduction & movement logging)
                    let priceMultiplier = 0;
                    let areaM2 = 0;
                    if (item.unitType === 'm') {
                        priceMultiplier = widthCm * heightCm;
                        areaM2 = widthCm * heightCm;
                    } else if (item.unitType === 'cm') {
                        priceMultiplier = (widthCm * heightCm) / 10000; // cm² → m², price is per m²
                        areaM2 = (widthCm * heightCm) / 10000;          // convert to m² for stock
                    } else if (item.unitType === 'menit') {
                        priceMultiplier = widthCm;
                        areaM2 = widthCm;
                    } else {
                        priceMultiplier = (widthCm * heightCm) / 10000;
                        areaM2 = (widthCm * heightCm) / 10000;
                    }

                    areaCm2 = areaM2 * 10000;

                    // PCS/kopi — berapa kali dimensi ini dicetak
                    const pcs = Math.max(1, Math.round(Number(item.pcs) || 1));
                    const totalAreaM2 = areaM2 * pcs; // total area untuk stock & BOM

                    lineTotal = priceMultiplier * resolvedPrice * pcs;
                    // Admin custom price override for AREA_BASED mode (overrides full line total)
                    if (item.customPrice != null) lineTotal = item.customPrice;

                    if (!requiresProduction && trackStock) {
                        // Multi-cabang: stok DIKURANGI dari cabang PELAKSANA (productionBranchId).
                        // Kalau bukan titipan, productionBranchId = branchId (fallback di atas), jadi tetap sama.
                        const stockBranchId = productionBranchId ?? branchId;
                        await this._assertBranchStock(tx, stockBranchId, variant.id, totalAreaM2, variant.product.name);
                        await this._adjustStock(tx, stockBranchId, variant.id, -totalAreaM2);
                        await this.logMovement(tx, variant.id, 'OUT', totalAreaM2, `Penjualan Cetak ${widthCm}×${heightCm}${item.unitType || 'm'} ×${pcs}pcs (${totalAreaM2.toFixed(2)}m²)`, undefined, stockBranchId);

                        // Deduct product-level BOM (AREA_BASED)
                        const ingredients = (variant.product as any).ingredients || [];
                        for (const ing of ingredients) {
                            if (ing.rawMaterialVariantId) {
                                const neededStock = Number(ing.quantity) * totalAreaM2;
                                await this._adjustStock(tx, stockBranchId, ing.rawMaterialVariantId, -neededStock);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', neededStock, `Terpotong oleh Penjualan ${variant.product.name}`, undefined, stockBranchId);
                            }
                        }

                        // Deduct variant-level ingredients (AREA_BASED, non-service-cost only)
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const neededStock = Number(ing.quantity) * totalAreaM2;
                                await this._adjustStock(tx, stockBranchId, ing.rawMaterialVariantId, -neededStock);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', neededStock, `Terpotong (varian) oleh Penjualan ${variant.product.name}`, undefined, stockBranchId);
                            }
                        }
                    }

                    // Click log data for AREA_BASED — variant-level takes priority over product-level
                    const _areaClickRate = (variant as any).clickRate ?? (variant.product as any).clickRate;
                    const _areaClicksPerUnit = (variant as any).clicksPerUnit ?? (variant.product as any).clicksPerUnit ?? 1;
                    transactionItemsData.push({
                        productVariantId: variant.id,
                        quantity: 1,
                        priceAtTime: resolvedPrice,  // per-m² price (total derived from priceAtTime × area × pcs)
                        hppAtTime: resolvedHpp,
                        widthCm,
                        heightCm,
                        areaCm2,
                        pcs,
                        unitType: item.unitType || 'm',
                        note: item.note || null,
                        _requiresProduction: requiresProduction,
                        _clickRateId: _areaClickRate?.isActive ? _areaClickRate.id : null,
                        _clickQuantity: _areaClickRate?.isActive ? Math.max(1, Math.round(pcs * _areaClicksPerUnit)) : 0,
                        _clickPricePerClick: _areaClickRate ? Number(_areaClickRate.pricePerClick) : 0,
                    });

                } else {
                    // Standard UNIT mode
                    if (trackStock) {
                        // Multi-cabang: stok dari cabang PELAKSANA (kalau titip cetak, dari cabang tujuan).
                        const stockBranchId = productionBranchId ?? branchId;
                        await this._assertBranchStock(tx, stockBranchId, variant.id, item.quantity, variant.product.name);
                        await this._adjustStock(tx, stockBranchId, variant.id, -item.quantity);
                        await this.logMovement(tx, variant.id, 'OUT', item.quantity, `Penjualan (Checkout)`, undefined, stockBranchId);
                    }

                    lineTotal = resolvedPrice * item.quantity;
                    // Click log data for UNIT — variant-level takes priority over product-level
                    const _unitClickRate = (variant as any).clickRate ?? (variant.product as any).clickRate;
                    const _unitClicksPerUnit = (variant as any).clicksPerUnit ?? (variant.product as any).clicksPerUnit ?? 1;
                    transactionItemsData.push({
                        productVariantId: variant.id,
                        quantity: item.quantity,
                        priceAtTime: resolvedPrice,
                        hppAtTime: resolvedHpp,
                        note: item.note || null,
                        _requiresProduction: requiresProduction,
                        _clickRateId: _unitClickRate?.isActive ? _unitClickRate.id : null,
                        _clickQuantity: _unitClickRate?.isActive ? Math.max(1, Math.round(item.quantity * _unitClicksPerUnit)) : 0,
                        _clickPricePerClick: _unitClickRate ? Number(_unitClickRate.pricePerClick) : 0,
                    });

                    // Deduct product-level BOM (UNIT)
                    const ingredients = (variant.product as any).ingredients || [];
                    for (const ing of ingredients) {
                        if (ing.rawMaterialVariantId) {
                            const neededStock = Number(ing.quantity) * item.quantity;
                            await this._adjustStock(tx, branchId, ing.rawMaterialVariantId, -neededStock);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', neededStock, `Terpotong oleh Penjualan ${variant.product.name}`, undefined, branchId);
                        }
                    }

                    // Deduct variant-level ingredients (UNIT, non-service-cost only)
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const neededStock = Number(ing.quantity) * item.quantity;
                            await this._adjustStock(tx, branchId, ing.rawMaterialVariantId, -neededStock);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', neededStock, `Terpotong (varian) oleh Penjualan ${variant.product.name}`, undefined, branchId);
                        }
                    }
                }

                subtotal += lineTotal;
            }

            const discountAmount = data.discount || 0;
            const amountAfterDiscount = subtotal - discountAmount;

            let taxAmount = 0;
            if (enableTax) {
                taxAmount = amountAfterDiscount * (taxRate / 100);
            }

            const shippingCost = data.shippingCost || 0;
            const grandTotal = amountAfterDiscount + taxAmount + shippingCost;
            const isPayLater = data.saveOnly === true;
            // saveOnly + DP > 0 → status PARTIAL (terima uang muka saat simpan invoice)
            const downPayment = isPayLater
                ? (data.downPayment != null && data.downPayment > 0 ? data.downPayment : 0)
                : (data.downPayment !== undefined ? data.downPayment : grandTotal);
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

            // Format tanggal untuk prefix invoice — pakai local time bukan UTC
            const y = effectiveDate.getFullYear();
            const m = String(effectiveDate.getMonth() + 1).padStart(2, '0');
            const d = String(effectiveDate.getDate()).padStart(2, '0');
            const dateStr = `${y}${m}${d}`;
            const prefix = `SO-${dateStr}-`;

            // Cari invoice terakhir hari ini berdasarkan prefix (lebih reliable dari count)
            const lastToday = await tx.transaction.findFirst({
                where: { invoiceNumber: { startsWith: prefix } },
                orderBy: { invoiceNumber: 'desc' },
                select: { invoiceNumber: true }
            });
            const nextSeq = lastToday
                ? parseInt(lastToday.invoiceNumber.slice(prefix.length), 10) + 1
                : 1;
            const invoiceNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;

            // Generate SC number jika transaksi langsung PAID (bayar lunas di kasir)
            let checkoutNumber: string | null = null;
            if (status === TransactionStatus.PAID) {
                const scPrefix = `SC-${dateStr}-`;
                const lastSC = await tx.transaction.findFirst({
                    where: { checkoutNumber: { startsWith: scPrefix } },
                    orderBy: { checkoutNumber: 'desc' },
                    select: { checkoutNumber: true },
                });
                const nextSCSeq = lastSC ? parseInt(lastSC.checkoutNumber!.slice(scPrefix.length), 10) + 1 : 1;
                checkoutNumber = `${scPrefix}${nextSCSeq.toString().padStart(4, '0')}`;
            }

            // Strip internal flags before creating items
            const itemsForCreate = transactionItemsData.map(({ _requiresProduction, _clickRateId, _clickQuantity, _clickPricePerClick, ...rest }: any) => rest);

            const transaction = await tx.transaction.create({
                data: {
                    invoiceNumber,
                    totalAmount: subtotal,
                    discount: discountAmount,
                    shippingCost: shippingCost,
                    tax: taxAmount,
                    grandTotal,
                    paymentMethod: data.paymentMethod,
                    status: status,
                    customerName: data.customerName || null,
                    customerPhone: data.customerPhone || null,
                    customerAddress: data.customerAddress || null,
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
            const jobDateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
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
                if (d._clickRateId && d._clickQuantity > 0 && d._clickPricePerClick > 0) {
                    const txItem = (transaction as any).items[i];
                    await (tx as any).clickLog.create({
                        data: {
                            clickRateId: d._clickRateId,
                            transactionItemId: txItem.id,
                            quantity: d._clickQuantity,
                            pricePerClick: d._clickPricePerClick,
                            totalCost: d._clickPricePerClick * d._clickQuantity,
                            date: effectiveDate,
                            // Click counter mengikuti cabang produksi (mesin fisik ada di sana).
                            branchId: productionBranchId,
                        },
                    });

                    // Auto-create PrintJob for paper print tracking
                    const jobNumber = `${prtPrefix}${String(prtSeq).padStart(4, '0')}`;
                    prtSeq += 1;
                    await (tx as any).printJob.create({
                        data: {
                            jobNumber,
                            transactionId: transaction.id,
                            transactionItemId: txItem.id,
                            // Antrian print jalan di cabang produksi, bukan cabang kasir.
                            branchId: productionBranchId,
                            quantity: txItem.quantity,
                            status: 'ANTRIAN',
                            notes: d.note || null,
                        },
                    });
                }
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
                await tx.cashflow.create({
                    data: {
                        type: CashflowType.INCOME,
                        category: status === TransactionStatus.PARTIAL ? 'Pembayaran DP' : 'Penjualan Lunas',
                        amount: downPayment,
                        paymentMethod: data.paymentMethod,
                        bankAccountId: data.bankAccountId || null,
                        note: `Pembayaran Invoice ${invoiceNumber}${customerInfo}${branchInfo} via ${data.paymentMethod}`,
                        branchName: effectiveBranchName,
                        branchId: branchId,
                        date: effectiveCashflowDate,
                    } as any
                });
            }

            // Catat diskon sebagai pengeluaran agar laporan keuangan akurat
            if (discountAmount > 0) {
                await tx.cashflow.create({
                    data: {
                        type: CashflowType.EXPENSE,
                        category: 'Diskon',
                        amount: discountAmount,
                        paymentMethod: data.paymentMethod,
                        bankAccountId: data.bankAccountId || null,
                        note: `Diskon Invoice ${invoiceNumber}${customerInfo}${branchInfo}`,
                        branchName: effectiveBranchName,
                        branchId: branchId,
                        date: effectiveCashflowDate,
                    } as any
                });
            }

            // Hook: tandai SalesOrder sebagai INVOICED jika transaksi dibuat dari SO
            if (data.salesOrderId) {
                try {
                    const so = await (tx as any).salesOrder.findUnique({ where: { id: data.salesOrderId } });
                    if (so && so.status !== 'INVOICED' && so.status !== 'CANCELLED') {
                        await (tx as any).salesOrder.update({
                            where: { id: data.salesOrderId },
                            data: {
                                status: 'INVOICED',
                                invoicedAt: new Date(),
                                transactionId: transaction.id,
                            },
                        });
                    }
                } catch (e) {
                    // Fail silently — transaksi sudah sukses, SO link bisa diperbaiki manual
                    console.error('Failed to mark SO as INVOICED', e);
                }
            }

            return transaction;
        }).then(async (result) => {
            // Cek stok menipis setelah transaksi selesai (di luar prisma.$transaction)
            this.checkLowStock(data.items.map(i => i.productVariantId)).catch(() => { });

            // Kirim notif transaksi baru ke Discord
            this.notifyNewTransactionDiscord(result, data).catch(() => { });

            return result;
        });
    }

    private async notifyNewTransactionDiscord(transaction: any, data: any) {
        const settings = await this.prisma.storeSettings.findFirst();
        const discordUrl = (settings as any)?.discordWebhookUrl;
        if (!discordUrl) return;
        if ((settings as any)?.notifyNewTransaction === false) return;

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
                const unit = item.unitType || 'm';
                if (unit === 'menit') {
                    dimensiStr = ` [${item.widthCm} unit]`;
                } else {
                    const suffix = unit === 'cm' ? 'cm' : 'm';
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

        await this.notificationsService.sendToDiscord(
            discordUrl,
            `🛒 **Order Berhasil Masuk**\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 Invoice: \`${invoiceNumber}\`\n` +
            `👥 Pelanggan: **${customerName}**` +
            cashierLine +
            employeeLine +
            deadlineLine +
            priorityLine +
            orderNotes +
            `\n\n**🧾 Detail Item:**\n${itemLines}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 Total: **Rp ${grandTotal}**  |  💳 ${paymentLabel}`,
        );
    }

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

        for (const variant of variants) {
            if (variant.stock <= threshold) {
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
            }
        }
    }

    async findAll(branchCtx?: BranchContext, startDate?: string, endDate?: string, search?: string) {
        const where: any = branchCtx ? { ...branchWhere(branchCtx) } : {};
        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate + 'T23:59:59.999Z'),
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

    async findOne(id: number) {
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
        return transaction;
    }

    async addPartialPayment(id: number, data: { amount: number; paymentMethod: PaymentMethod; bankAccountId?: number }) {
        return this.prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.findUnique({ where: { id } });
            if (!transaction) throw new NotFoundException('Transaction not found');
            if (transaction.status === TransactionStatus.PAID) throw new BadRequestException('Transaksi sudah lunas');
            if (transaction.status !== TransactionStatus.PARTIAL && transaction.status !== TransactionStatus.PENDING)
                throw new BadRequestException('Transaksi tidak dapat menerima pembayaran');

            const currentDP = Number(transaction.downPayment);
            const grandTotal = Number(transaction.grandTotal);
            const remaining = grandTotal - currentDP;

            if (data.amount <= 0) throw new BadRequestException('Nominal harus lebih dari 0');
            if (data.amount > remaining) throw new BadRequestException('Nominal melebihi sisa tagihan');

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
                } as any
            });

            if (willBePaid) {
                // Promosi ke PAID — generate SC number
                const now = new Date();
                const cy = now.getFullYear();
                const cm = String(now.getMonth() + 1).padStart(2, '0');
                const cd = String(now.getDate()).padStart(2, '0');
                const scPrefix = `SC-${cy}${cm}${cd}-`;
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
        });
    }

    async payOff(id: number, data: { paymentMethod: PaymentMethod, bankAccountId?: number, checkoutCashierName?: string, paidAt?: string }) {
        return this.prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.findUnique({ where: { id } });
            if (!transaction) throw new NotFoundException('Transaction not found');
            if (transaction.status === TransactionStatus.PAID) throw new BadRequestException('Transaksi sudah lunas');
            if (transaction.status !== TransactionStatus.PARTIAL && transaction.status !== TransactionStatus.PENDING)
                throw new BadRequestException('Transaksi tidak dapat dilunasi');

            const remainingBalance = Number(transaction.grandTotal) - Number(transaction.downPayment);

            if (remainingBalance > 0) {
                const customerInfo = transaction.customerName ? ` untuk Bpk/Ibu ${transaction.customerName}` : '';
                const branchInfoPO = (transaction as any).branchName ? ` [${(transaction as any).branchName}]` : '';
                const isFromPending = transaction.status === TransactionStatus.PENDING;
                await tx.cashflow.create({
                    data: {
                        type: CashflowType.INCOME,
                        category: isFromPending ? 'Penjualan Lunas' : 'Pelunasan DP',
                        amount: remainingBalance,
                        paymentMethod: data.paymentMethod,
                        bankAccountId: data.bankAccountId || null,
                        note: `${isFromPending ? 'Pembayaran' : 'Pelunasan'} Invoice ${transaction.invoiceNumber}${customerInfo}${branchInfoPO} via ${data.paymentMethod}`,
                        branchName: (transaction as any).branchName || null,
                        branchId: (transaction as any).branchId ?? null,
                    } as any
                });
            }

            // Tentukan tanggal checkout (manual dari kasir, atau sekarang)
            const checkoutDate = data.paidAt ? new Date(data.paidAt) : new Date();

            // Generate nomor SC berdasarkan tanggal checkout
            const cy = checkoutDate.getFullYear();
            const cm = String(checkoutDate.getMonth() + 1).padStart(2, '0');
            const cd = String(checkoutDate.getDate()).padStart(2, '0');
            const scPrefix = `SC-${cy}${cm}${cd}-`;

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
        });
    }

    async updatePaymentMethod(id: number, data: { paymentMethod: PaymentMethod; bankAccountId?: number }) {
        return this.prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.findUniqueOrThrow({ where: { id } });

            const updated = await tx.transaction.update({
                where: { id },
                data: {
                    paymentMethod: data.paymentMethod,
                    bankAccountId: data.bankAccountId ?? null,
                }
            });

            await tx.cashflow.updateMany({
                where: {
                    note: { contains: transaction.invoiceNumber },
                    type: CashflowType.INCOME,
                },
                data: {
                    paymentMethod: data.paymentMethod,
                    bankAccountId: data.bankAccountId ?? null,
                }
            });

            return updated;
        });
    }

    async getSummaryReport(branchCtx: BranchContext | undefined, startDate?: string, endDate?: string, sortBy: 'qty' | 'revenue' = 'qty', limit: number = 20) {
        // Gunakan updatedAt sebagai acuan tanggal, bukan createdAt.
        // Nota PENDING yang dibuat hari X tapi dibayar hari Y akan masuk ke laporan hari Y (updatedAt berubah saat status → PAID).
        const bw = branchCtx ? branchWhere(branchCtx) : {};
        const whereClause: any = { status: TransactionStatus.PAID, ...bw };
        if (startDate && endDate) {
            whereClause.updatedAt = {
                gte: new Date(startDate),
                lte: new Date(endDate + 'T23:59:59.999Z')
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
            const start = new Date(startDate);
            const end = new Date(endDate + 'T23:59:59.999Z');
            const durationMs = end.getTime() - start.getTime();
            const prevEnd = new Date(start.getTime() - 1);
            const prevStart = new Date(prevEnd.getTime() - durationMs);
            const prevTransactions = await this.prisma.transaction.findMany({
                where: {
                    status: TransactionStatus.PAID,
                    updatedAt: { gte: prevStart, lte: prevEnd },
                    ...(branchCtx ? branchWhere(branchCtx) : {}),
                },
                include: {
                    items: { include: { productVariant: true } }
                }
            });
            for (const t of prevTransactions) {
                for (const item of t.items) {
                    const vid = item.productVariantId;
                    if (!prevItemSales[vid]) prevItemSales[vid] = { qty: 0, revenue: 0 };
                    prevItemSales[vid].qty += item.quantity;
                    prevItemSales[vid].revenue += Number(item.priceAtTime) * item.quantity;
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
                itemSales[variantId].qty += item.quantity;
                itemSales[variantId].revenue += Number(item.priceAtTime) * item.quantity;
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
        const cfWhere: any = { type: CashflowType.INCOME, userId: null, ...bw };
        if (startDate && endDate) {
            cfWhere.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate + 'T23:59:59.999Z'),
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
                where: { createdAt: { gte: start }, type: CashflowType.INCOME, userId: null, ...bw },
                select: { createdAt: true, amount: true }
            });
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const total = cfs
                    .filter(c => c.createdAt?.toISOString().split('T')[0] === dateStr)
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
                    where: { createdAt: { gte: weekStart, lte: weekEnd }, type: CashflowType.INCOME, userId: null, ...bw },
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
                    where: { createdAt: { gte: monthStart, lte: monthEnd }, type: CashflowType.INCOME, userId: null, ...bw },
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
                    where: { createdAt: { gte: yearStart, lte: yearEnd }, type: CashflowType.INCOME, userId: null, ...bw },
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
            where: { updatedAt: { gte: start, lte: end }, status: TransactionStatus.PAID, ...bw },
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
            todayTxCount,      // Jumlah transaksi lunas hari ini (berdasarkan updatedAt)
            yesterdayTxCount,  // Jumlah transaksi lunas kemarin
            todayCashflow,     // Total cashflow masuk hari ini (semua, untuk card cashflow)
            yesterdayCashflow, // Total cashflow masuk kemarin
            lowStockItems,
        ] = await Promise.all([
            // Sales card: sum cashflow auto-income hari ini (userId null = auto dari transaksi)
            this.prisma.cashflow.aggregate({
                where: { createdAt: { gte: todayStart }, type: CashflowType.INCOME, userId: null, ...bw },
                _sum: { amount: true },
            }),
            this.prisma.cashflow.aggregate({
                where: { createdAt: { gte: yesterdayStart, lt: todayStart }, type: CashflowType.INCOME, userId: null, ...bw },
                _sum: { amount: true },
            }),
            // Tx count: hitung transaksi yang statusnya PAID dan updatedAt hari ini
            this.prisma.transaction.count({
                where: { updatedAt: { gte: todayStart }, status: TransactionStatus.PAID, ...bw },
            }),
            this.prisma.transaction.count({
                where: { updatedAt: { gte: yesterdayStart, lt: todayStart }, status: TransactionStatus.PAID, ...bw },
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
    ) {
        const jobDateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
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
                ...(jobBranchId != null ? { branchId: jobBranchId } : {}),
            },
        });
    }

    private async applyTransactionEdit(tx: any, transactionId: number, editData: TransactionEditData): Promise<void> {
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

        const settings = await tx.storeSettings.findFirst();
        const enableTax = settings?.enableTax ?? true;
        const taxRate = settings?.taxRate ? Number(settings.taxRate) : 10;

        // Multi-cabang: restore/decrement stok ke BranchStock cabang transaksi.
        const editTxBranchId: number | null = (transaction as any).branchId ?? null;

        let newSubtotal = 0;

        // ── HAPUS ITEM yang ditandai remove: true ──────────────────────────────
        const removeItems = editData.items.filter((e) => e.remove && e.id);
        for (const editItem of removeItems) {
            const txItem = transaction.items.find((i: any) => i.id === editItem.id);
            if (!txItem) continue;
            const variant = txItem.productVariant;
            const product = variant.product;
            const pricingMode = product.pricingMode || 'UNIT';
            const trackStock = product.trackStock !== false;
            const variantIngredients: any[] = variant.variantIngredients || [];
            const productIngredients: any[] = product.ingredients || [];

            if (trackStock) {
                if (pricingMode === 'AREA_BASED') {
                    const areaM2 = txItem.areaCm2 ? Number(txItem.areaCm2) / 10000 : 0;
                    if (areaM2 > 0) {
                        await this._adjustStock(tx, editTxBranchId, variant.id, areaM2);
                        await this.logMovement(tx, variant.id, 'IN', Math.ceil(areaM2 * 100), `Hapus Item Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                        for (const ing of productIngredients) {
                            if (ing.rawMaterialVariantId) {
                                const ret = Number(ing.quantity) * areaM2;
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', Math.ceil(ret * 100), `Hapus Item (BOM) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            }
                        }
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const ret = Number(ing.quantity) * areaM2;
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', Math.ceil(ret * 100), `Hapus Item (varian BOM) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            }
                        }
                    }
                } else {
                    const qty = txItem.quantity;
                    if (qty > 0) {
                        await this._adjustStock(tx, editTxBranchId, variant.id, qty);
                        await this.logMovement(tx, variant.id, 'IN', qty, `Hapus Item Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                        for (const ing of productIngredients) {
                            if (ing.rawMaterialVariantId) {
                                const ret = Number(ing.quantity) * qty;
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', Math.ceil(ret * 100), `Hapus Item (BOM) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            }
                        }
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const ret = Number(ing.quantity) * qty;
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', Math.ceil(ret * 100), `Hapus Item (varian BOM) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            }
                        }
                    }
                }
            }
            // Hapus ProductionJob dulu (FK constraint: productionJob.transactionItemId → transactionItem.id)
            await tx.productionJob.deleteMany({ where: { transactionItemId: txItem.id } });
            await tx.transactionItem.delete({ where: { id: txItem.id } });
        }

        // ── TAMBAH ITEM BARU ────────────────────────────────────────────────────
        const newItems = editData.items.filter((e) => !e.id && e.newVariantId && !e.remove);
        for (const editItem of newItems) {
            const variant = await tx.productVariant.findUnique({
                where: { id: editItem.newVariantId },
                include: { product: { include: { ingredients: true } }, variantIngredients: true, priceTiers: { orderBy: { minQty: 'asc' } } }
            });
            if (!variant) throw new NotFoundException(`Variant ID ${editItem.newVariantId} tidak ditemukan`);
            const product = (variant as any).product;
            const pricingMode = product.pricingMode || 'UNIT';
            const trackStock = product.trackStock !== false;
            const variantIngredients: any[] = (variant as any).variantIngredients || [];
            const productIngredients: any[] = product.ingredients || [];

            let lineTotal = 0;
            let unitResolvedPrice = 0; // per-unit price for UNIT mode (for priceAtTime storage)
            let widthCm: number | null = null;
            let heightCm: number | null = null;
            let areaCm2: number | null = null;
            let qty = editItem.quantity ?? 1;

            if (pricingMode === 'AREA_BASED') {
                const w = editItem.widthCm ?? 1;
                const h = editItem.heightCm ?? 1;
                const unit = editItem.unitType || 'm';
                widthCm = w; heightCm = h;
                let priceMultiplier = 0;
                let areaM2 = 0;
                if (unit === 'm') { priceMultiplier = w * h; areaM2 = w * h; }
                else if (unit === 'cm') { priceMultiplier = (w * h) / 10000; areaM2 = (w * h) / 10000; } // cm² → m²
                else if (unit === 'menit') { priceMultiplier = w; areaM2 = w; }
                else { priceMultiplier = (w * h) / 10000; areaM2 = (w * h) / 10000; }
                areaCm2 = areaM2 * 10000;
                const itemPcs = Math.max(1, editItem.pcs ?? 1);
                lineTotal = editItem.priceOverride != null ? editItem.priceOverride : priceMultiplier * Number(variant.price) * itemPcs;

                if (trackStock) {
                    await this._assertBranchStock(tx, editTxBranchId, variant.id, areaM2, product.name);
                    await this._adjustStock(tx, editTxBranchId, variant.id, -areaM2);
                    await this.logMovement(tx, variant.id, 'OUT', Math.ceil(areaM2 * 100), `Tambah Item Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                    for (const ing of productIngredients) {
                        if (ing.rawMaterialVariantId) {
                            const needed = Number(ing.quantity) * areaM2;
                            await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -needed);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', Math.ceil(needed * 100), `Tambah Item (BOM) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                        }
                    }
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const needed = Number(ing.quantity) * areaM2;
                            await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -needed);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', Math.ceil(needed * 100), `Tambah Item (varian BOM) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                        }
                    }
                }
                qty = 1;
            } else {
                let resolvedPrice = Number(variant.price);
                const priceTiers: any[] = (variant as any).priceTiers || [];
                if (priceTiers.length > 0) {
                    const matched = priceTiers.find((t: any) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty));
                    if (matched) resolvedPrice = Number(matched.price);
                }
                if (editItem.priceOverride != null) resolvedPrice = editItem.priceOverride;
                lineTotal = resolvedPrice * qty;
                unitResolvedPrice = resolvedPrice; // capture per-unit price for priceAtTime storage

                if (trackStock) {
                    await this._assertBranchStock(tx, editTxBranchId, variant.id, qty, product.name);
                    await this._adjustStock(tx, editTxBranchId, variant.id, -qty);
                    await this.logMovement(tx, variant.id, 'OUT', qty, `Tambah Item Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                    for (const ing of productIngredients) {
                        if (ing.rawMaterialVariantId) {
                            const needed = Number(ing.quantity) * qty;
                            await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -needed);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', Math.ceil(needed * 100), `Tambah Item (BOM) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                        }
                    }
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const needed = Number(ing.quantity) * qty;
                            await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -needed);
                            await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', Math.ceil(needed * 100), `Tambah Item (varian BOM) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                        }
                    }
                }
            }

            // Hitung HPP dari variantIngredients atau fallback ke variant.hpp
            let hppAtTime = Number(variant.hpp);
            if (variantIngredients.length > 0) {
                hppAtTime = variantIngredients.reduce((s: number, ing: any) => s + Number(ing.price) * Number(ing.quantity), 0);
            }

            // Store per-m² price for AREA_BASED, per-unit price for UNIT (consistent with original checkout)
            const itemPriceAtTime = pricingMode === 'AREA_BASED' ? Number(variant.price) : unitResolvedPrice;
            const newTxItem = await tx.transactionItem.create({
                data: { transactionId, productVariantId: variant.id, quantity: qty, priceAtTime: itemPriceAtTime, hppAtTime, widthCm, heightCm, areaCm2, pcs: pricingMode === 'AREA_BASED' ? Math.max(1, editItem.pcs ?? 1) : 1 }
            });

            // Create production job if product requires production
            if (product.requiresProduction) {
                await this.createProductionJobForItem(
                    tx, transactionId, newTxItem.id,
                    transaction.productionPriority || 'NORMAL',
                    transaction.productionDeadline || null,
                    transaction.productionNotes || null,
                );
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

            const variant = txItem.productVariant;
            const product = variant.product;
            const pricingMode = product.pricingMode || 'UNIT';
            const trackStock = product.trackStock !== false;
            const variantIngredients: any[] = variant.variantIngredients || [];
            const productIngredients: any[] = product.ingredients || [];

            if (pricingMode === 'AREA_BASED') {
                const newW = editItem.widthCm ?? Number(txItem.widthCm);
                const newH = editItem.heightCm ?? Number(txItem.heightCm ?? 1);
                const unitType = editItem.unitType || 'm';

                let newPriceMultiplier = 0;
                let newAreaM2 = 0;

                if (unitType === 'm') {
                    newPriceMultiplier = newW * newH;
                    newAreaM2 = newW * newH;
                } else if (unitType === 'cm') {
                    newPriceMultiplier = (newW * newH) / 10000; // cm² → m²
                    newAreaM2 = (newW * newH) / 10000;
                } else if (unitType === 'menit') {
                    newPriceMultiplier = newW;
                    newAreaM2 = newW;
                } else {
                    newPriceMultiplier = (newW * newH) / 10000;
                    newAreaM2 = (newW * newH) / 10000;
                }

                const newAreaCm2 = newAreaM2 * 10000;
                const oldAreaM2 = txItem.areaCm2 ? Number(txItem.areaCm2) / 10000 : 0;
                const areaDelta = newAreaM2 - oldAreaM2;

                if (trackStock && Math.abs(areaDelta) > 0.0001) {
                    // delta positif = area bertambah → kurangi stok; delta negatif = area berkurang → kembalikan stok.
                    if (areaDelta > 0) {
                        await this._assertBranchStock(tx, editTxBranchId, variant.id, areaDelta, product.name);
                        await this._adjustStock(tx, editTxBranchId, variant.id, -areaDelta);
                        await this.logMovement(tx, variant.id, 'OUT', Math.ceil(areaDelta * 100), `Koreksi Edit Transaksi ${transaction.invoiceNumber} (area bertambah)`, undefined, editTxBranchId);
                    } else {
                        const returnM2 = Math.abs(areaDelta);
                        await this._adjustStock(tx, editTxBranchId, variant.id, returnM2);
                        await this.logMovement(tx, variant.id, 'IN', Math.ceil(returnM2 * 100), `Koreksi Edit Transaksi ${transaction.invoiceNumber} (area berkurang)`, undefined, editTxBranchId);
                    }

                    // Adjust product-level BOM (AREA_BASED)
                    for (const ing of productIngredients) {
                        if (ing.rawMaterialVariantId) {
                            const ingDelta = Number(ing.quantity) * areaDelta;
                            if (ingDelta > 0) {
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -ingDelta);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', Math.ceil(ingDelta * 100), `Koreksi Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            } else if (ingDelta < 0) {
                                const ret = Math.abs(ingDelta);
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', Math.ceil(ret * 100), `Koreksi Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            }
                        }
                    }

                    // Adjust variant-level BOM (AREA_BASED)
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const ingDelta = Number(ing.quantity) * areaDelta;
                            if (ingDelta > 0) {
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -ingDelta);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', Math.ceil(ingDelta * 100), `Koreksi (varian) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            } else if (ingDelta < 0) {
                                const ret = Math.abs(ingDelta);
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', Math.ceil(ret * 100), `Koreksi (varian) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            }
                        }
                    }
                }

                const newPcs = Math.max(1, editItem.pcs ?? 1);
                const newLineTotal = editItem.priceOverride != null ? editItem.priceOverride : newPriceMultiplier * Number(variant.price) * newPcs;
                // Store per-m² price in priceAtTime (consistent with original checkout format)
                // The total is derived from priceAtTime × area × pcs at display/calculation time
                const storedPriceAtTime = Number(variant.price);

                await tx.transactionItem.update({
                    where: { id: txItem.id },
                    data: { widthCm: newW, heightCm: newH, areaCm2: newAreaCm2, priceAtTime: storedPriceAtTime, pcs: newPcs }
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
                        );
                    }
                }

                newSubtotal += newLineTotal;

            } else {
                // UNIT mode
                const newQty = editItem.quantity ?? txItem.quantity;
                if (newQty < 1) throw new BadRequestException(`Jumlah item minimal 1`);
                const delta = newQty - txItem.quantity;

                if (trackStock && delta !== 0) {
                    if (delta > 0) {
                        await this._assertBranchStock(tx, editTxBranchId, variant.id, delta, product.name);
                        await this._adjustStock(tx, editTxBranchId, variant.id, -delta);
                        await this.logMovement(tx, variant.id, 'OUT', delta, `Koreksi Edit Transaksi ${transaction.invoiceNumber} (qty bertambah)`, undefined, editTxBranchId);
                    } else {
                        const returnQty = Math.abs(delta);
                        await this._adjustStock(tx, editTxBranchId, variant.id, returnQty);
                        await this.logMovement(tx, variant.id, 'IN', returnQty, `Koreksi Edit Transaksi ${transaction.invoiceNumber} (qty berkurang)`, undefined, editTxBranchId);
                    }

                    // Adjust product-level BOM (UNIT)
                    for (const ing of productIngredients) {
                        if (ing.rawMaterialVariantId) {
                            const ingDelta = Number(ing.quantity) * delta;
                            if (ingDelta > 0) {
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -ingDelta);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', Math.ceil(Math.abs(ingDelta) * 100), `Koreksi Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            } else if (ingDelta < 0) {
                                const ret = Math.abs(ingDelta);
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', Math.ceil(ret * 100), `Koreksi Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            }
                        }
                    }

                    // Adjust variant-level BOM (UNIT)
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const ingDelta = Number(ing.quantity) * delta;
                            if (ingDelta > 0) {
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, -ingDelta);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'OUT', Math.ceil(Math.abs(ingDelta) * 100), `Koreksi (varian) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            } else if (ingDelta < 0) {
                                const ret = Math.abs(ingDelta);
                                await this._adjustStock(tx, editTxBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', Math.ceil(ret * 100), `Koreksi (varian) Edit Transaksi ${transaction.invoiceNumber}`, undefined, editTxBranchId);
                            }
                        }
                    }
                }

                // Price override untuk UNIT mode
                const resolvedPrice = editItem.priceOverride != null ? editItem.priceOverride : Number(txItem.priceAtTime);
                await tx.transactionItem.update({ where: { id: txItem.id }, data: { quantity: newQty, priceAtTime: resolvedPrice } });

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
            if (removedIds.has(existingItem.id) || editedIds.has(existingItem.id)) continue;
            // newItems are already counted in newSubtotal above
            if (existingItem.widthCm !== null) {
                // AREA_BASED: priceAtTime is per-m² price, total = priceAtTime × area × pcs
                const areaM2 = existingItem.areaCm2 ? Number(existingItem.areaCm2) / 10000 : 0;
                const existingPcs = Math.max(1, Number(existingItem.pcs) || 1);
                newSubtotal += areaM2 > 0 ? Number(existingItem.priceAtTime) * areaM2 * existingPcs : Number(existingItem.priceAtTime);
            } else {
                newSubtotal += Number(existingItem.priceAtTime) * existingItem.quantity;
            }
        }

        const discountAmount = editData.discount !== undefined ? editData.discount : Number(transaction.discount);
        const amountAfterDiscount = newSubtotal - discountAmount;
        const taxAmount = enableTax ? amountAfterDiscount * (taxRate / 100) : 0;
        const newGrandTotal = amountAfterDiscount + taxAmount;

        await tx.transaction.update({
            where: { id: transactionId },
            data: {
                totalAmount: newSubtotal,
                discount: discountAmount,
                tax: taxAmount,
                grandTotal: newGrandTotal,
                customerName: editData.customerName !== undefined ? editData.customerName : transaction.customerName,
                customerPhone: editData.customerPhone !== undefined ? editData.customerPhone : transaction.customerPhone,
                customerAddress: editData.customerAddress !== undefined ? editData.customerAddress : transaction.customerAddress,
            }
        });

        // Update cashflow if PAID
        if (transaction.status === 'PAID') {
            await tx.cashflow.updateMany({
                where: { note: { contains: transaction.invoiceNumber }, type: CashflowType.INCOME },
                data: { amount: newGrandTotal }
            });
        }
    }

    async editTransactionDirect(id: number, roleId: number | null, editData: TransactionEditData) {
        // Transaksi PENDING (draft invoice) boleh diedit siapa saja — belum ada pembayaran
        const transaction = await this.prisma.transaction.findUnique({ where: { id } });
        if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');
        const isPending = transaction.status === TransactionStatus.PENDING;
        if (!isPending && !(await this.isAdminOrOwner(roleId))) {
            throw new ForbiddenException('Hanya Admin/Owner yang dapat mengedit transaksi yang sudah terbayar');
        }
        return this.prisma.$transaction(async (tx) => {
            await this.applyTransactionEdit(tx, id, editData);
            return tx.transaction.findUniqueOrThrow({
                where: { id },
                include: { items: { include: { productVariant: { include: { product: true } } } } }
            });
        });
    }

    async createEditRequest(transactionId: number, requestedById: number, reason: string, editData: TransactionEditData) {
        const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
        if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');
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

    async getEditRequests(status?: string) {
        return (this.prisma as any).transactionEditRequest.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                transaction: { select: { id: true, invoiceNumber: true, grandTotal: true, status: true, items: { include: { productVariant: { include: { product: true } } } } } },
                requestedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
            }
        });
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
                await this.applyTransactionEdit(tx, req.transactionId, req.editData as TransactionEditData);
                await (tx as any).transactionEditRequest.update({
                    where: { id: requestId },
                    data: { status: 'APPROVED', reviewedById: reviewerId, reviewNote: reviewNote || null }
                });
            });
            this.notificationsService.emit({
                type: 'system',
                title: 'Permintaan Edit Disetujui',
                message: `Perubahan transaksi telah diterapkan.${reviewNote ? ` Catatan: ${reviewNote}` : ''}`,
            });
        } else {
            await (this.prisma as any).transactionEditRequest.update({
                where: { id: requestId },
                data: { status: 'REJECTED', reviewedById: reviewerId, reviewNote: reviewNote || null }
            });
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

    async deleteTransaction(id: number, roleId: number | null) {
        if (!(await this.isAdminOrOwner(roleId))) {
            throw new ForbiddenException('Hanya Admin/Owner yang dapat menghapus transaksi');
        }
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
                    }
                }
            });
            if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

            // Restore stok semua item (multi-cabang: kembalikan ke BranchStock cabang transaksi)
            const txBranchId: number | null = (transaction as any).branchId ?? null;
            // eslint-disable-next-line no-console
            console.log(`[DELETE-TX] ${transaction.invoiceNumber} branchId=${txBranchId} items=${transaction.items.length}`);
            for (const txItem of transaction.items) {
                const variant = txItem.productVariant;
                const product = (variant as any).product;
                const pricingMode = product.pricingMode || 'UNIT';
                const trackStock = product.trackStock !== false;
                const variantIngredients: any[] = (variant as any).variantIngredients || [];
                const productIngredients: any[] = product.ingredients || [];
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
                                await this.logMovement(tx, job.rollVariantId, 'IN', rollArea, `Hapus Transaksi (roll) ${transaction.invoiceNumber}`, undefined, restoreBranchId);
                            }
                        }
                        // Kalau assembly sudah dilakukan (job.status pernah PASANG/SELESAI-assembly), BOM rangka juga
                        // sudah dipotong di startAssembly — kembalikan.
                        if (job && (job.status === 'PASANG' || job.assemblyStartedAt || job.assemblyCompletedAt)) {
                            const restoreBranchId: number | null = (job as any).branchId ?? txBranchId;
                            for (const ing of productIngredients) {
                                if (ing.rawMaterialVariantId) {
                                    const ret = Number(ing.quantity);
                                    await this._adjustStock(tx, restoreBranchId, ing.rawMaterialVariantId, ret);
                                    await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (pasang BOM) ${transaction.invoiceNumber}`, undefined, restoreBranchId);
                                }
                            }
                        }
                        continue;
                    }

                    if (!trackStock) continue;

                    // Bug fix: kalikan kembali dengan pcs × quantity (sama persis dengan yang dipotong saat create)
                    const pcs = Number((txItem as any).pcs ?? 1);
                    const itemQty = Number(txItem.quantity ?? 1);
                    const areaM2 = txItem.areaCm2 ? (Number(txItem.areaCm2) / 10000) * pcs * itemQty : 0;
                    if (areaM2 > 0) {
                        // eslint-disable-next-line no-console
                        console.log(`    → restore AREA_BASED variant=${variant.id} +${areaM2}m² to branch=${txBranchId}`);
                        await this._adjustStock(tx, txBranchId, variant.id, areaM2);
                        await this.logMovement(tx, variant.id, 'IN', areaM2, `Hapus Transaksi ${transaction.invoiceNumber}`, undefined, txBranchId);
                        for (const ing of productIngredients) {
                            if (ing.rawMaterialVariantId) {
                                const ret = Number(ing.quantity) * areaM2;
                                await this._adjustStock(tx, txBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (BOM) ${transaction.invoiceNumber}`, undefined, txBranchId);
                            }
                        }
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const ret = Number(ing.quantity) * areaM2;
                                await this._adjustStock(tx, txBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (varian BOM) ${transaction.invoiceNumber}`, undefined, txBranchId);
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

                        // Kembalikan stok produk induk HANYA kalau trackStock=true
                        if (trackStock) {
                            await this._adjustStock(tx, txBranchId, variant.id, qty);
                            await this.logMovement(tx, variant.id, 'IN', qty, `Hapus Transaksi ${transaction.invoiceNumber}`, undefined, txBranchId);
                        }

                        // BOM selalu dikembalikan (terlepas dari trackStock induk)
                        for (const ing of productIngredients) {
                            if (ing.rawMaterialVariantId) {
                                const ret = Number(ing.quantity) * qty;
                                // eslint-disable-next-line no-console
                                console.log(`      ↳ BOM restore raw=${ing.rawMaterialVariantId} +${ret}`);
                                await this._adjustStock(tx, txBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (BOM) ${transaction.invoiceNumber}`, undefined, txBranchId);
                            }
                        }
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const ret = Number(ing.quantity) * qty;
                                // eslint-disable-next-line no-console
                                console.log(`      ↳ varian-BOM restore raw=${ing.rawMaterialVariantId} +${ret}`);
                                await this._adjustStock(tx, txBranchId, ing.rawMaterialVariantId, ret);
                                await this.logMovement(tx, ing.rawMaterialVariantId, 'IN', ret, `Hapus Transaksi (varian BOM) ${transaction.invoiceNumber}`, undefined, txBranchId);
                            }
                        }
                    }
                }
            }

            // Hapus cashflow terkait (INCOME penjualan + EXPENSE diskon)
            await tx.cashflow.deleteMany({
                where: { note: { contains: transaction.invoiceNumber } }
            });

            // Hapus ProductionJob untuk semua item (FK tanpa onDelete Cascade)
            const itemIds = transaction.items.map((i: any) => i.id);
            if (itemIds.length > 0) {
                await (tx as any).productionJob.deleteMany({ where: { transactionItemId: { in: itemIds } } });
            }

            // Hapus transaksi (cascade hapus items)
            await tx.transaction.delete({ where: { id } });

            return { success: true, invoiceNumber: transaction.invoiceNumber };
        });
    }
}
