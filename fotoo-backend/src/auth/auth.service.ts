import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { User } from '../entities/user.entity.js';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    return this.users.validatePassword(username, password);
  }

  async login(user: User) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, username: user.username, role: user.role, displayName: user.displayName },
    };
  }
}
