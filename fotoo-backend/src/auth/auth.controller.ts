import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from '../utils/local-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    return this.auth.login(req.user);
  }
}
