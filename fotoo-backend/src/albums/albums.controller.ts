import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards, Patch } from '@nestjs/common';
import { AlbumsService } from './albums.service';
import { JwtAuthGuard } from '../utils/jwt-auth.guard';
import { IsString } from 'class-validator';

class CreateAlbumDto {
  @IsString()
  name: string;
}

class AddMemberDto {
  @IsString()
  username: string;
}

class RenameAlbumDto {
  @IsString()
  name: string;
}

@Controller('albums')
@UseGuards(JwtAuthGuard)
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  @Post()
  async create(@Body() dto: CreateAlbumDto, @Req() req: any) {
    return this.albums.create(dto.name, req.user.userId);
  }

  @Get()
  async list(@Req() req: any) {
    return this.albums.listForUser(req.user.userId);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    const can = await this.albums.canAccess(id, req.user.userId);
    if (!can) return { error: 'Forbidden' };
    return this.albums.get(id);
  }

  @Get(':id/media')
  async listMedia(@Param('id') id: string, @Req() req: any) {
    const can = await this.albums.canAccess(id, req.user.userId);
    if (!can) return [];
    return this.albums.listMedia(id, 100);
  }

  @Post(':id/members')
  async addMember(@Param('id') id: string, @Body() dto: AddMemberDto, @Req() req: any) {
    // Only owner can manage members
    const album = await this.albums.get(id);
    if (!album || album.owner.id !== req.user.userId) return { error: 'Forbidden' };
    return this.albums.addMember(id, dto.username);
  }

  @Delete(':id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string, @Req() req: any) {
    const album = await this.albums.get(id);
    if (!album || album.owner.id !== req.user.userId) return { error: 'Forbidden' };
    return this.albums.removeMember(id, userId);
  }

  @Post(':id/upload-url')
  async uploadUrl() {
    return { error: 'Direct uploads to album are disabled. Upload to user first, then add to album.' };
  }

  @Post(':id/assets')
  async addAsset(@Param('id') id: string, @Body() body: { assetId: string }, @Req() req: any) {
    return this.albums.addAsset(id, body.assetId, req.user.userId);
  }

  @Delete(':id/assets/:assetId')
  async removeAsset(@Param('id') id: string, @Param('assetId') assetId: string, @Req() req: any) {
    return this.albums.removeAsset(id, assetId, req.user.userId);
  }

  @Patch(':id')
  async rename(@Param('id') id: string, @Body() dto: RenameAlbumDto, @Req() req: any) {
    return this.albums.rename(id, dto.name, req.user.userId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.albums.deleteAlbum(id, req.user.userId);
  }
}
