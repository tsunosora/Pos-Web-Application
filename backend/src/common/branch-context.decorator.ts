import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Branch context untuk scoping data multi-cabang.
 * - `branchId`: ID cabang aktif untuk request ini. `null` artinya "semua cabang" (Owner only).
 * - `isOwner`: true kalau user pakai role OWNER/SUPERADMIN (bisa lintas cabang).
 * - `userBranchId`: cabang asli user dari JWT (buat audit/default).
 */
export interface BranchContext {
    branchId: number | null;
    isOwner: boolean;
    userBranchId: number | null;
    roleName: string | null;
}

const OWNER_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN'];

export function isOwnerRole(roleName?: string | null): boolean {
    if (!roleName) return false;
    return OWNER_ROLES.includes(roleName.toUpperCase());
}

/**
 * `@CurrentBranch()` — resolve branch context dari JWT payload + header `X-Branch-Id`.
 *
 * Aturan:
 * - Staff (non-owner): `branchId` di-lock ke `req.user.branchId`. Header diabaikan.
 *   Kalau user staff tidak punya branchId → ForbiddenException (salah seed).
 * - Owner/SuperAdmin: baca header `X-Branch-Id`.
 *    - Angka valid → branchId = angka itu.
 *    - Header kosong / "all" / "null" → branchId = null (mode "Semua Cabang").
 */
export const CurrentBranch = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): BranchContext => {
        const req = ctx.switchToHttp().getRequest();
        const user = req.user ?? {};
        const roleName: string | null = user.roleName ?? null;
        const userBranchId: number | null =
            typeof user.branchId === 'number' ? user.branchId : null;
        const owner = isOwnerRole(roleName);

        if (!owner) {
            if (userBranchId == null) {
                throw new ForbiddenException(
                    'User staff belum ter-assign ke cabang manapun. Hubungi admin.',
                );
            }
            return {
                branchId: userBranchId,
                isOwner: false,
                userBranchId,
                roleName,
            };
        }

        // Owner / SuperAdmin: boleh pilih cabang via header.
        const raw =
            req.headers['x-branch-id'] ??
            req.headers['X-Branch-Id'] ??
            req.query?.branchId;

        let branchId: number | null = null;
        if (raw != null && raw !== '' && raw !== 'all' && raw !== 'null') {
            const parsed = Number(raw);
            if (!Number.isNaN(parsed) && parsed > 0) {
                branchId = parsed;
            }
        }

        return {
            branchId,
            isOwner: true,
            userBranchId,
            roleName,
        };
    },
);
