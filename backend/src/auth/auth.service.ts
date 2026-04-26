import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    // Multi-cabang: ikutkan branchId & roleName di JWT supaya scoping bisa dilakukan tanpa lookup DB.
    // roleName dipakai untuk deteksi Owner/SuperAdmin (bypass branch lock).
    const roleName = user.role?.name ?? null;
    const branchId = (user as any).branchId ?? null;
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.roleId,
      roleName,
      branchId,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(createUserDto: any) {
    return this.usersService.create(createUserDto);
  }
}
