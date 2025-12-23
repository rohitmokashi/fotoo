import { Body, Controller, Param, Post, Put, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { Roles } from '../utils/roles.decorator';
import { RolesGuard } from '../utils/roles.guard';
import { JwtAuthGuard } from '../utils/jwt-auth.guard';

class CreateUserDto {
  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class SetPasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersAdminController {
  constructor(private readonly users: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.users.createUser({ username: dto.username, email: dto.email, displayName: dto.displayName, password: dto.password, role: 'user' });
    return user;
  }

  @Put(':id/password')
  async setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    const user = await this.users.setPassword(id, dto.password);
    return user;
  }
}
