import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'username', passwordField: 'password', passReqToCallback: false });
  }

  async validate(username: string, password: string) {
    const user = await this.auth.validateUser(username, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}
