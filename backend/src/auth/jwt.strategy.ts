import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { getJwtSecret } from './jwt-secret.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly usersService: UsersService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: getJwtSecret(),
        });
    }

    // Selalu lookup user terbaru dari DB — bukan pakai data yang di-embed di JWT.
    // Ini memastikan perubahan branch/role oleh admin langsung berlaku tanpa
    // user harus logout & login ulang.
    async validate(payload: any) {
        const user = await this.usersService.findById(payload.sub);
        if (!user || (user as any).isActive === false) {
            throw new UnauthorizedException('Akun tidak aktif.');
        }
        return {
            userId: payload.sub,
            email: payload.email,
            // Peran SELALU dari DB. Dulu jatuh ke isi token bila peran dicabut → token lama tetap
            // "Admin" sampai 1 hari & bisa dipakai memulihkan perannya sendiri.
            role: user?.role?.id ?? null,
            roleName: user?.role?.name ?? null,
            // Daftar menu yang diizinkan owner untuk peran ini (null = preset divisi).
            menuAccess: (user?.role as any)?.menuAccess ?? null,
            branchId: user?.branchId ?? null,
        };
    }
}
