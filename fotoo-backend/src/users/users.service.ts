import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async findByUsername(username: string, withPassword = false) {
    if (withPassword) {
      return this.repo
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.username = :username', { username })
        .getOne();
    }
    return this.repo.findOne({ where: { username } });
  }

  async createUser(params: { username: string; email?: string; displayName?: string; role?: 'user' | 'admin'; password?: string }) {
    const existing = await this.repo.findOne({ where: { username: params.username } });
    if (existing) return existing;
    const hash = await argon2.hash(params.password || '');
    const user = this.repo.create({
      username: params.username,
      passwordHash: hash,
      email: params.email || `${params.username}@local`,
      displayName: params.displayName || params.username,
      role: params.role || 'user',
    });
    let saved = await this.repo.save(user);
    return saved;
  }

  async setPassword(userId: string, password: string) {
    const hash = await argon2.hash(password);
    await this.repo.update({ id: userId }, { passwordHash: hash });
    const updated = await this.repo.findOne({ where: { id: userId } });
    return updated!;
  }

  async validatePassword(username: string, password: string) {
    const user = await this.findByUsername(username, true);
    if (!user || !user.passwordHash) return null;
    const ok = await argon2.verify(user.passwordHash, password);
    return ok ? user : null;
  }

  async ensureAdmin(username: string, password: string) {
    let admin = await this.repo.findOne({ where: { username } });
    if (!admin) {
      admin = await this.createUser({ username, role: 'admin', password, email: `${username}@admin.local`, displayName: 'Administrator' });
      this.logger.log(`Created admin user '${username}'`);
    } else {
      // update password to ensure access
      await this.setPassword(admin.id, password);
      this.logger.log(`Updated admin user password for '${username}'`);
    }
    return admin;
  }
}
