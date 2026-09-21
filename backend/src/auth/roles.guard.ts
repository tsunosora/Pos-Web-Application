import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const mentah = String(user?.roleName ?? '');
    // Nama non-ASCII tak pernah cocok (huruf mirip bisa di-toUpperCase menjadi "SUPERADMIN").
    const roleName = /^[\x20-\x7E]*$/.test(mentah) ? mentah.toUpperCase() : '';
    if (!required.map(r => r.toUpperCase()).includes(roleName)) {
      throw new ForbiddenException('Akses ditolak: butuh role admin.');
    }
    return true;
  }
}
