import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// Nama role di-uppercase; cocokkan dengan pola OWNER/SUPERADMIN/SUPER_ADMIN.
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
