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

  // Hash acak (bukan sandi siapa pun) untuk menyamakan lama jawaban saat email tak terdaftar.
  private static readonly HASH_PALSU = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.oM7p3O2p3zqNfYbVqWQ8Lh6nC1vW';

  async validateUser(email: string, pass: string): Promise<any> {
    // Bukan teks → gagal biasa (dulu bcrypt melempar → 500 & tak terhitung pembatas percobaan).
    if (typeof email !== 'string' || typeof pass !== 'string' || !email || pass.length > 200) return null;
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Tetap hitung bcrypt supaya lama jawaban tak membocorkan email mana yang terdaftar.
      await bcrypt.compare(pass, AuthService.HASH_PALSU).catch(() => false);
      return null;
    }
    if (await bcrypt.compare(pass, user.passwordHash)) {
      if ((user as any).isActive === false) {
        return null; // akun dinonaktifkan — tolak login
      }
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
}
