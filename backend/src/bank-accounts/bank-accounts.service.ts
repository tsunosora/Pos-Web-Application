import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch, assertBranchAccess } from '../common/branch-where.helper';

/**
 * Hanya kolom ini yang boleh diisi dari klien (T-15). Dulu seluruh body disebar ke
 * Prisma, sehingga `currentBalance: 999999999` ikut tersimpan — saldo dikarang dari
 * luar. Saldo hanya berubah lewat transaksi/kas atau "Reset saldo".
 */
function pilihKolom(data: any, wajib: boolean) {
    const out: { bankName?: string; accountNumber?: string; accountOwner?: string; isActive?: boolean } = {};
    for (const k of ['bankName', 'accountNumber', 'accountOwner'] as const) {
        if (data?.[k] === undefined) {
            if (wajib) throw new BadRequestException('Nama bank, nomor rekening, dan nama pemilik wajib diisi.');
            continue;
        }
        const v = String(data[k] ?? '').trim();
        if (!v) throw new BadRequestException('Nama bank, nomor rekening, dan nama pemilik tidak boleh kosong.');
        out[k] = v.slice(0, 100);
    }
    if (data?.isActive !== undefined) out.isActive = !!data.isActive;
    return out;
}

@Injectable()
export class BankAccountsService {
    constructor(private prisma: PrismaService) { }

    async findAll(branchCtx: BranchContext) {
        return this.prisma.bankAccount.findMany({
            where: { ...branchWhere(branchCtx) } as any,
            orderBy: { createdAt: 'asc' },
        });
    }

    async create(
        data: { bankName: string; accountNumber: string; accountOwner: string; isActive?: boolean },
        branchCtx: BranchContext,
    ) {
        const branchId = requireBranch(branchCtx);
        return this.prisma.bankAccount.create({ data: { ...pilihKolom(data, true), branchId } as any });
    }

    async update(
        id: number,
        data: { bankName?: string; accountNumber?: string; accountOwner?: string; isActive?: boolean },
        branchCtx: BranchContext,
    ) {
        const existing = await this.prisma.bankAccount.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Rekening tidak ditemukan');
        assertBranchAccess(branchCtx, (existing as any).branchId ?? null);
        return this.prisma.bankAccount.update({ where: { id }, data: pilihKolom(data, false) });
    }

    async resetBalance(id: number, newBalance: number, branchCtx: BranchContext) {
        const existing = await this.prisma.bankAccount.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Rekening tidak ditemukan');
        assertBranchAccess(branchCtx, (existing as any).branchId ?? null);
        const saldo = Number(newBalance);
        if (!Number.isFinite(saldo)) throw new BadRequestException('Saldo baru harus berupa angka.');
        return this.prisma.bankAccount.update({
            where: { id },
            data: { currentBalance: saldo },
        });
    }

    async remove(id: number, branchCtx: BranchContext) {
        const existing = await this.prisma.bankAccount.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Rekening tidak ditemukan');
        assertBranchAccess(branchCtx, (existing as any).branchId ?? null);
        // Masih dipakai nota/kas → jangan dihapus (dulu nota & kas kehilangan rekeningnya, transfer
        // lenyap dari ringkasan per rekening, saldonya tak ikut tutup buku). Nonaktifkan saja.
        const [nota, kas] = await Promise.all([
            this.prisma.transaction.count({ where: { OR: [{ bankAccountId: id }, { dpBankAccountId: id } as any] } }),
            this.prisma.cashflow.count({ where: { bankAccountId: id } }),
        ]);
        if (nota + kas > 0) {
            throw new BadRequestException(`Rekening ini dipakai ${nota} nota & ${kas} catatan kas — tidak bisa dihapus. Nonaktifkan saja (sembunyikan dari pilihan).`);
        }
        return this.prisma.bankAccount.delete({ where: { id } });
    }
}
