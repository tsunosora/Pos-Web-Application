import { BadRequestException } from '@nestjs/common';
import type { BranchContext } from './branch-context.decorator';

/**
 * Helper untuk build Prisma `where` filter berdasarkan branch context.
 *
 * Kalau `ctx.branchId` ada → return `{ branchId: ctx.branchId }`.
 * Kalau null (Owner mode "Semua Cabang") → return `{}` (no filter).
 *
 * Contoh:
 *   const items = await prisma.transaction.findMany({
 *     where: { ...branchWhere(ctx), status: 'PAID' },
 *   });
 */
export function branchWhere(
    ctx: Pick<BranchContext, 'branchId'>,
    field: string = 'branchId',
): Record<string, number> | Record<string, never> {
    if (ctx.branchId == null) return {};
    return { [field]: ctx.branchId };
}

/**
 * Untuk endpoint write (create/update) yang wajib menentukan cabang spesifik.
 * Kalau Owner sedang di mode "Semua Cabang", tolak — karena tidak jelas datanya
 * masuk ke cabang mana.
 */
export function requireBranch(ctx: Pick<BranchContext, 'branchId'>): number {
    if (ctx.branchId == null) {
        throw new BadRequestException(
            'Aksi ini butuh cabang spesifik. Pilih cabang di topbar terlebih dahulu (bukan "Semua Cabang").',
        );
    }
    return ctx.branchId;
}

/**
 * Untuk cek apakah user boleh akses resource dari cabang tertentu.
 * Staff hanya boleh akses branchId == userBranchId.
 * Owner boleh akses semuanya.
 */
export function assertBranchAccess(
    ctx: BranchContext,
    resourceBranchId: number | null | undefined,
): void {
    if (ctx.isOwner) return;
    if (resourceBranchId == null) return; // data global (shared)
    if (resourceBranchId !== ctx.userBranchId) {
        throw new BadRequestException(
            'Anda tidak memiliki akses ke data cabang lain.',
        );
    }
}
