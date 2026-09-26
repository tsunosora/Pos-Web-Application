import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatasService } from '../lisensi/batas.service';

@Injectable()
export class CompanyBranchesService {
    /**
     * `batas` = pemeriksa batas angka lisensi (`limit.branches`), dari `LisensiModule` yang
     * @Global. Wajib, bukan opsional: batas yang diam-diam mati lebih buruk daripada aplikasi
     * yang gagal naik dengan galat DI yang jelas.
     */
    constructor(
        private prisma: PrismaService,
        private readonly batas: BatasService,
    ) {}

    async findAll() {
        return (this.prisma as any).companyBranch.findMany({
            orderBy: { name: 'asc' },
        });
    }

    /** Daftar publik (tanpa login): hanya identitas — dulu ikut target omzet harian tiap cabang. */
    async findAllActivePublic(): Promise<{ id: number; name: string; code: string | null; phone: string | null }[]> {
        return (this.prisma as any).companyBranch.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true, phone: true },
            orderBy: { name: 'asc' },
        });
    }

    async findAllActive(): Promise<{ id: number; name: string; code: string | null; phone: string | null; dailyTargetOverride: any }[]> {
        return (this.prisma as any).companyBranch.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true, phone: true, dailyTargetOverride: true },
            orderBy: { name: 'asc' },
        });
    }

    async create(data: {
        name: string;
        address?: string;
        phone?: string;
        code?: string;
        notaHeader?: string;
        notaFooter?: string;
        logoUrl?: string;
    }) {
        if (!data.name?.trim()) throw new BadRequestException('Nama cabang wajib diisi');

        // Batas jumlah cabang dari kunci lisensi. Cuma di sini — `update` (termasuk menyalakan
        // kembali cabang yang nonaktif) sengaja TIDAK diperiksa: klien yang sudah lewat batas
        // harus tetap bisa merapikan datanya, dan itu justru jalan keluarnya. Tanpa kunci
        // lisensi, baris ini tidak melakukan apa pun.
        await this.batas.wajibBolehMenambah('limit.branches');

        return (this.prisma as any).companyBranch.create({
            data: {
                name: data.name.trim(),
                address: data.address?.trim() || null,
                phone: data.phone?.trim() || null,
                code: data.code?.trim().toUpperCase() || null,
                notaHeader: data.notaHeader?.trim() || null,
                notaFooter: data.notaFooter?.trim() || null,
                logoUrl: data.logoUrl?.trim() || null,
            },
        });
    }

    async update(
        id: number,
        data: {
            name?: string;
            address?: string;
            phone?: string;
            isActive?: boolean;
            code?: string | null;
            notaHeader?: string | null;
            notaFooter?: string | null;
            logoUrl?: string | null;
            dailyTargetOverride?: number | null;
        },
    ) {
        const existing = await (this.prisma as any).companyBranch.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Cabang tidak ditemukan');
        const upd: any = {};
        if (data.name !== undefined) upd.name = data.name.trim();
        if ('address' in data) upd.address = data.address?.trim() || null;
        if ('phone' in data) upd.phone = data.phone?.trim() || null;
        if ('code' in data) upd.code = data.code?.trim().toUpperCase() || null;
        if ('notaHeader' in data) upd.notaHeader = data.notaHeader?.trim() || null;
        if ('notaFooter' in data) upd.notaFooter = data.notaFooter?.trim() || null;
        if ('logoUrl' in data) upd.logoUrl = data.logoUrl?.trim() || null;
        if (data.isActive !== undefined) upd.isActive = data.isActive;
        if ('dailyTargetOverride' in data) {
            const v = (data as any).dailyTargetOverride;
            const n = Number(v);
            if (v !== null && v !== '' && (!Number.isFinite(n) || n < 0)) throw new BadRequestException('Target harian harus angka ≥ 0.');
            upd.dailyTargetOverride = (v === null || v === '') ? null : n;
        }
        return (this.prisma as any).companyBranch.update({ where: { id }, data: upd });
    }

    async remove(id: number) {
        const existing = await (this.prisma as any).companyBranch.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Cabang tidak ditemukan');
        // Cek apakah masih ada work order aktif
        const activeWO = await (this.prisma as any).branchWorkOrder.count({
            where: { branchId: id, status: { in: ['ANTRIAN', 'PROSES'] } },
        });
        if (activeWO > 0) throw new BadRequestException('Cabang masih memiliki work order aktif. Selesaikan terlebih dahulu.');
        // Cabang yang sudah punya riwayat tak boleh dihapus (FK SET NULL → nota/kas kehilangan cabangnya).
        const db = this.prisma as any;
        const [trx, kas, akun, stok] = await Promise.all([
            db.transaction.count({ where: { OR: [{ branchId: id }, { productionBranchId: id }] } }),
            db.cashflow.count({ where: { branchId: id } }),
            db.user.count({ where: { branchId: id } }),
            db.branchStock.count({ where: { branchId: id, stock: { not: 0 } } }),
        ]);
        const dipakai = [
            trx && `${trx} transaksi`,
            kas && `${kas} catatan kas`,
            akun && `${akun} akun karyawan`,
            stok && `${stok} stok barang`,
        ].filter(Boolean);
        if (dipakai.length) {
            throw new BadRequestException(
                `Cabang ini masih punya ${dipakai.join(', ')}. Jangan dihapus — nonaktifkan saja supaya riwayatnya tetap utuh.`,
            );
        }
        await db.companyBranch.delete({ where: { id } });
        return { success: true };
    }
}
