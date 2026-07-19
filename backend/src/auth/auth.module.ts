import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { LoginThrottleService } from './login-throttle.service';
import { getJwtSecret } from './jwt-secret.util';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      global: true,
      secret: getJwtSecret(),
      // Masa berlaku bisa diatur via JWT_EXPIRES; default 1d (selaras cookie
      // frontend & lebih aman — jendela token bocor lebih pendek).
      // cast: tipe expiresIn adalah template-literal `ms`, string env perlu di-cast.
      signOptions: { expiresIn: (process.env.JWT_EXPIRES || '1d') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LoginThrottleService],
  exports: [LoginThrottleService],
})
export class AuthModule { }
