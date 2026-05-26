import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly usersService: UsersService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'super-secret',
        });
    }

    // Selalu lookup user terbaru dari DB — bukan pakai data yang di-embed di JWT.
    // Ini memastikan perubahan branch/role oleh admin langsung berlaku tanpa
    // user harus logout & login ulang.
    async validate(payload: any) {
        const user = await this.usersService.findById(payload.sub);
        return {
            userId: payload.sub,
            email: payload.email,
            role: user?.role?.id ?? payload.role,
            roleName: user?.role?.name ?? payload.roleName ?? null,
            branchId: user?.branchId ?? null,
        };
    }
}
