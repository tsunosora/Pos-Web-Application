import { Controller, Post, Get, Body, HttpCode, HttpStatus, HttpException, UnauthorizedException, UseGuards, Request, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginThrottleService } from './login-throttle.service';
import { clientIp } from './pin-throttle.interceptor';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('Security');

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly loginThrottle: LoginThrottleService,
  ) { }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() signInDto: Record<string, any>, @Request() req: any) {
    // IP dari cf-connecting-ip (tak bisa dipalsukan lewat Cloudflare) — dulu entri pertama
    // X-Forwarded-For yang bebas diisi penyerang, jadi kunci IP bisa diakali tiap request.
    const ip = clientIp(req);
    // Tiga hitungan (semua staf toko keluar lewat SATU IP publik, jadi kunci per-IP saja
    // bisa mengunci seisi toko karena beberapa orang salah ketik):
    //  - pasangan IP+email: 8× → hanya akun itu dari IP itu yang terkunci;
    //  - per IP: 30× → menebak banyak akun dari satu IP;
    //  - per email: 20× → menebak satu akun dari banyak IP.
    const email = String(signInDto?.email ?? '').trim().toLowerCase().slice(0, 120);
    const ipKey = `ip:${ip}`;
    const emailKey = email ? `email:${email}` : null;
    const pairKey = email ? `pair:${ip}|${email}` : null;

    // Brute-force lock: tolak lebih awal bila salah satu kunci sedang terkunci.
    const lockSec = Math.max(
      this.loginThrottle.isLocked(ipKey),
      emailKey ? this.loginThrottle.isLocked(emailKey) : 0,
      pairKey ? this.loginThrottle.isLocked(pairKey) : 0,
    );
    if (lockSec > 0) {
      this.logger.warn(`[SECURITY] login_locked email=${email} ip=${ip} retry_in=${lockSec}s`);
      throw new HttpException(
        'Terlalu banyak percobaan login gagal. Coba lagi beberapa menit lagi.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.authService.validateUser(signInDto.email, signInDto.password);
    if (!user) {
      // Catat untuk monitor keamanan (deteksi brute-force). Hanya metadata,
      // TIDAK pernah mencatat password.
      const byPair = pairKey ? this.loginThrottle.recordFailure(pairKey) : { locked: false, fails: 0 };
      const byIp = this.loginThrottle.recordFailure(ipKey, 30);
      const byEmail = emailKey ? this.loginThrottle.recordFailure(emailKey, 20) : { locked: false, fails: 0 };
      const locked = byPair.locked || byIp.locked || byEmail.locked;
      this.logger.warn(
        `[SECURITY] login_failed email=${email} ip=${ip} fails=${byPair.fails}/${byIp.fails}/${byEmail.fails}${locked ? ' -> LOCKED' : ''}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Sukses TIDAK mereset hitungan: satu akun sah tak boleh "mencuci" hitungan IP
    // lalu lanjut menebak akun lain. Hitungan habis sendiri sesuai jendela waktu.
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.findById(req.user.userId);
  }
}
