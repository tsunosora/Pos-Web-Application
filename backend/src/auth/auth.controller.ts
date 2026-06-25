import { Controller, Post, Get, Body, HttpCode, HttpStatus, HttpException, UnauthorizedException, UseGuards, Request, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginThrottleService } from './login-throttle.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('Security');

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly loginThrottle: LoginThrottleService,
  ) { }

  private clientIp(req: any): string {
    const raw = req?.headers?.['x-forwarded-for'] || req?.ip || req?.socket?.remoteAddress || 'unknown';
    return String(raw).split(',')[0].trim();
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() signInDto: Record<string, any>, @Request() req: any) {
    const ip = this.clientIp(req);

    // Brute-force lock: tolak lebih awal bila IP sedang terkunci.
    const lockSec = this.loginThrottle.isLocked(ip);
    if (lockSec > 0) {
      this.logger.warn(`[SECURITY] login_locked ip=${ip} retry_in=${lockSec}s`);
      throw new HttpException(
        'Terlalu banyak percobaan login gagal. Coba lagi beberapa menit lagi.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.authService.validateUser(signInDto.email, signInDto.password);
    if (!user) {
      // Catat untuk monitor keamanan (deteksi brute-force). Hanya metadata,
      // TIDAK pernah mencatat password.
      const email = String(signInDto?.email ?? '').slice(0, 120);
      const { locked, fails } = this.loginThrottle.recordFailure(ip);
      this.logger.warn(`[SECURITY] login_failed email=${email} ip=${ip} fails=${fails}${locked ? ' -> LOCKED' : ''}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Sukses: reset hitungan kegagalan untuk IP ini.
    this.loginThrottle.reset(ip);
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() signUpDto: Record<string, any>) {
    return this.authService.register(signUpDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.findById(req.user.userId);
  }
}
