import { Body, Controller, Delete, Get, Param, Post, Query, Res, UseGuards, Req } from '@nestjs/common';
import type { Response } from 'express';
import { MediaService } from './media.service';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../utils/jwt-auth.guard';
import { AlbumsService } from '../albums/albums.service';

class UploadUrlDto {
  @IsString()
  filename: string;

  @IsString()
  mimeType: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  size: number;

  @IsOptional()
  @IsString()
  capturedAt?: string; // ISO timestamp from client metadata (EXIF/video)
}

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService, private readonly albums: AlbumsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload-url')
  async createUploadUrl(@Body() dto: UploadUrlDto, @Req() req: any) {
    return this.media.createUploadUrl({ filename: dto.filename, mimeType: dto.mimeType, size: dto.size, ownerId: req.user.userId, capturedAt: dto.capturedAt });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: any, @Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.media.listAssets(n, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    return this.media.getAsset(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download-url')
  async downloadUrl(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const result = await this.media.getDownloadUrl(id, req.user.userId);
    if (!result) return res.status(404).send({ message: 'Not found' });
    return res.redirect(result.url);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/thumbnail')
  async thumbnail(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const result = await this.media.getImageThumbnail(id, req.user.userId);
    if (!result) return res.status(404).send({ message: 'Not found' });
    res.setHeader('Content-Type', result.contentType);
    result.stream.pipe(res);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/process')
  async process(@Req() req: any, @Param('id') id: string) {
    const out = await this.media.enqueueProcessing(id, req.user.userId);
    return out;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return { success: await this.media.deleteAsset(id, req.user.userId) };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/albums')
  async listAlbumsForAsset(@Req() req: any, @Param('id') id: string) {
    const asset = await this.media.getAsset(id, req.user.userId);
    if (!asset) return [];
    return this.albums.getAlbumsForAsset(id);
  }
}
