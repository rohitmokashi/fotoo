// No changes needed as required imports already exist.
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MediaModule } from './media/media.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AlbumsModule } from './albums/albums.module.js';
import { UsersService } from './users/users.service.js';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: ((() => {
          const host = config.get<string>('REDIS_HOST', 'localhost');
          const port = parseInt(config.get<string>('REDIS_PORT', '6379'), 10);
          const pwd = config.get<string>('REDIS_PASSWORD');
          return { host, port, password: pwd || undefined } as { host: string; port: number; password?: string };
        })()),
      }),
    }),
      TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'db.laaszydpqcbsalwovjha.supabase.co'),
        port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'root@1234'),
        database: config.get<string>('DB_NAME', 'postgres'),
        autoLoadEntities: true,
          synchronize: config.get<string>('DB_SYNC', 'true') === 'true',
      }),
    }),
    MediaModule,
    UsersModule,
    AuthModule,
    AlbumsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly config: ConfigService, private readonly users: UsersService) {}

  async onApplicationBootstrap() {
    const adminUser = this.config.get<string>('ADMIN_USERNAME', 'admin');
    const adminPass = this.config.get<string>('ADMIN_PASSWORD', 'admin123');
    await this.users.ensureAdmin(adminUser, adminPass);
  }
}
