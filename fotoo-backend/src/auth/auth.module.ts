import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const exp = config.get<string>('JWT_EXPIRES_IN', '1d');
        const match = exp.match(/^(\d+)([smhd])?$/);
        const expiresIn = match
          ? (() => {
              const val = parseInt(match[1], 10);
              const unit = match[2];
              switch (unit) {
                case 's':
                  return val;
                case 'm':
                  return val * 60;
                case 'h':
                  return val * 3600;
                case 'd':
                  return val * 86400;
                default:
                  return val; // plain seconds
              }
            })()
          : 86400;
        return {
          secret: config.get<string>('JWT_SECRET', 'dev_secret'),
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
