import { Controller, Post, Get, Body, HttpCode, HttpStatus, UnauthorizedException, UseGuards, Request, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('Security');

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) { }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() signInDto: Record<string, any>, @Request() req: any) {
    const user = await this.authService.validateUser(signInDto.email, signInDto.password);
    if (!user) {
      // Catat untuk monitor keamanan (deteksi brute-force). Hanya metadata,
      // TIDAK pernah mencatat password.
      const ip = req?.headers?.['x-forwarded-for'] || req?.ip || req?.socket?.remoteAddress || 'unknown';
      const email = String(signInDto?.email ?? '').slice(0, 120);
      this.logger.warn(`[SECURITY] login_failed email=${email} ip=${String(ip).split(',')[0].trim()}`);
      throw new UnauthorizedException('Invalid credentials');
    }
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
