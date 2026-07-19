import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function ctx(roleName: string) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user: { roleName } }) }),
  } as any;
}

describe('RolesGuard', () => {
  it('mengizinkan OWNER', () => {
    const r = { getAllAndOverride: () => ['OWNER', 'SUPERADMIN'] } as unknown as Reflector;
    expect(new RolesGuard(r).canActivate(ctx('OWNER'))).toBe(true);
  });
  it('menolak role biasa', () => {
    const r = { getAllAndOverride: () => ['OWNER', 'SUPERADMIN'] } as unknown as Reflector;
    expect(() => new RolesGuard(r).canActivate(ctx('CS'))).toThrow(ForbiddenException);
  });
  it('mengizinkan bila tak ada role wajib', () => {
    const r = { getAllAndOverride: () => undefined } as unknown as Reflector;
    expect(new RolesGuard(r).canActivate(ctx('CS'))).toBe(true);
  });
  it('cocok case-insensitive: role "Admin" masuk daftar ["OWNER","ADMIN"]', () => {
    const r = { getAllAndOverride: () => ['OWNER', 'ADMIN'] } as unknown as Reflector;
    expect(new RolesGuard(r).canActivate(ctx('Admin'))).toBe(true);
  });
  it('menolak Operator walau Admin diizinkan', () => {
    const r = { getAllAndOverride: () => ['OWNER', 'ADMIN'] } as unknown as Reflector;
    expect(() => new RolesGuard(r).canActivate(ctx('Operator'))).toThrow(ForbiddenException);
  });
});
