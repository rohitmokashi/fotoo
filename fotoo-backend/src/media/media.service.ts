import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaAsset } from '../entities/media-asset.entity';
import { User } from '../entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { AlbumsService } from '../albums/albums.service';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

interface CreateUploadUrlParams {
  filename: string;
  mimeType: string;
  size: number;
  ownerId: string;
  capturedAt?: string;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(MediaAsset) private readonly mediaRepo: Repository<MediaAsset>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly storage: StorageService,
    private readonly albums: AlbumsService,
    @InjectQueue('media-processing') private readonly processingQueue: Queue,
  ) {}

  private async getOwnerById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new Error('Owner not found');
    return user;
  }

  async createUploadUrl(params: CreateUploadUrlParams) {
    const owner = await this.getOwnerById(params.ownerId);
    const now = new Date();
    const captured = params.capturedAt ? new Date(params.capturedAt) : null;
    const dateForKey = captured && !isNaN(captured.getTime()) ? captured : now;
    const y = now.getUTCFullYear();
    const m = String(dateForKey.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateForKey.getUTCDate()).padStart(2, '0');
    const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${owner.username}/${y}/${m}/${d}/${randomUUID()}_${safeName}`;

    const bucket = this.storage.getBucket();

    const asset = this.mediaRepo.create({
      owner,
      bucket,
      key,
      mimeType: params.mimeType,
      size: String(params.size),
      capturedAt: captured || undefined,
    });
    const saved = await this.mediaRepo.save(asset);

    const uploadUrl = await this.storage.getUploadUrl(key, params.mimeType);
    return { uploadUrl, asset: saved };
  }

  async enqueueProcessing(assetId: string, requesterId?: string) {
    const asset = await this.mediaRepo.findOne({ where: { id: assetId }, relations: ['owner'] });
    if (!asset) throw new Error('Asset not found');
    if (requesterId && asset.owner?.id !== requesterId) {
      throw new Error('Forbidden');
    }
    await this.processingQueue.add('convert-asset', { assetId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    return { enqueued: true };
  }

  async listAssets(limit = 50, ownerId?: string): Promise<MediaAsset[]> {
    const where: any = ownerId ? { owner: { id: ownerId } } : {};
    return this.mediaRepo.find({ where, take: limit, order: { capturedAt: 'DESC', createdAt: 'DESC' }, relations: ['owner'] });
  }

  async getAsset(id: string, ownerId?: string): Promise<MediaAsset | null> {
    const where: any = { id };
    if (ownerId) where.owner = { id: ownerId };
    return this.mediaRepo.findOne({ where, relations: ['owner'] });
  }

  async getDownloadUrl(id: string, requesterId?: string) {
    const asset = await this.mediaRepo.findOne({ where: { id }, relations: ['owner'] });
    if (!asset) return null;
    let allowed = requesterId ? asset.owner?.id === requesterId : false;
    if (!allowed && requesterId) {
      allowed = await this.albums.hasAccessToAsset(requesterId, id);
    }
    if (!allowed) return null;
    // Prefer processed asset if available; originals may remain inaccessible from UI
    const key = asset.processedKey || null;
    if (!key) return null;
    const url = await this.storage.getDownloadUrl(key);
    return { url, asset };
  }

  async deleteAsset(id: string, ownerId?: string) {
    const asset = await this.getAsset(id, ownerId);
    if (!asset) return false;
    await this.albums.detachAssetFromAll(id);
    await this.storage.deleteObject(asset.key);
    await this.mediaRepo.delete({ id });
    return true;
  }

  async getImageThumbnail(id: string, requesterId?: string, width = 512): Promise<{ stream: Readable; contentType: string } | null> {
    const asset = await this.mediaRepo.findOne({ where: { id }, relations: ['owner'] });
    if (!asset) return null;
    let allowed = requesterId ? asset.owner?.id === requesterId : false;
    if (!allowed && requesterId) allowed = await this.albums.hasAccessToAsset(requesterId, id);
    if (!allowed) return null;
    if (!asset.processedMimeType) return null;
    if (asset.processedMimeType.startsWith('image/')) {
      if (asset.thumbnailKey) {
        const { body } = await this.storage.getObjectStream(asset.thumbnailKey);
        return { stream: body as Readable, contentType: asset.thumbnailMimeType || 'image/jpeg' };
      }
      // Fallback: serve processed image directly (no local transformation)
      if (asset.processedKey) {
        const { body } = await this.storage.getObjectStream(asset.processedKey);
        return { stream: body as Readable, contentType: asset.processedMimeType };
      }
      return null;
    }
    if (asset.processedMimeType.startsWith('video/')) {
      if (!asset.thumbnailKey) return null; // Require stored thumbnail for videos
      const { body } = await this.storage.getObjectStream(asset.thumbnailKey);
      return { stream: body as Readable, contentType: asset.thumbnailMimeType || 'image/jpeg' };
    }
    return null;
  }

  // Backend performs all format conversions and thumbnail generation via Docker containers.
}
