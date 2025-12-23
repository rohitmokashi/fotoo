import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Album } from '../entities/album.entity';
import { User } from '../entities/user.entity';
import { MediaAsset } from '../entities/media-asset.entity';
import { StorageService } from '../storage/storage.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AlbumsService {
  constructor(
    @InjectRepository(Album) private readonly albums: Repository<Album>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(MediaAsset) private readonly media: Repository<MediaAsset>,
    private readonly storage: StorageService,
  ) {}

  async create(name: string, ownerId: string) {
    const owner = await this.users.findOne({ where: { id: ownerId } });
    if (!owner) throw new Error('Owner not found');
    const album = this.albums.create({ name, owner });
    return this.albums.save(album);
  }

  async addMember(albumId: string, username: string) {
    const album = await this.albums.findOne({ where: { id: albumId }, relations: ['members', 'owner'] });
    if (!album) throw new Error('Album not found');
    const user = await this.users.findOne({ where: { username } });
    if (!user) throw new Error('User not found');
    const has = album.members?.some((m) => m.id === user.id);
    if (!has) {
      album.members = [...(album.members || []), user];
      await this.albums.save(album);
    }
    return album;
  }

  async removeMember(albumId: string, userId: string) {
    const album = await this.albums.findOne({ where: { id: albumId }, relations: ['members'] });
    if (!album) throw new Error('Album not found');
    album.members = (album.members || []).filter((m) => m.id !== userId);
    await this.albums.save(album);
    return album;
  }

  private async isOwnerOrAdmin(albumId: string, userId: string) {
    const album = await this.albums.findOne({ where: { id: albumId }, relations: ['owner'] });
    if (!album) return false;
    if (album.owner.id === userId) return true;
    const user = await this.users.findOne({ where: { id: userId } });
    return user?.role === 'admin';
  }

  async rename(albumId: string, name: string, requesterId: string) {
    const allowed = await this.isOwnerOrAdmin(albumId, requesterId);
    if (!allowed) throw new Error('Forbidden');
    const album = await this.albums.findOne({ where: { id: albumId } });
    if (!album) throw new Error('Album not found');
    album.name = name;
    return this.albums.save(album);
  }

  async deleteAlbum(albumId: string, requesterId: string) {
    const allowed = await this.isOwnerOrAdmin(albumId, requesterId);
    if (!allowed) throw new Error('Forbidden');
    await this.albums.delete(albumId);
    return { success: true };
  }

  async listForUser(userId: string) {
    return this.albums
      .createQueryBuilder('album')
      .leftJoin('album.members', 'member')
      .leftJoin('album.owner', 'owner')
      .where('owner.id = :userId OR member.id = :userId', { userId })
      .orderBy('album.createdAt', 'DESC')
      .getMany();
  }

  async canAccess(albumId: string, userId: string) {
    const album = await this.albums
      .createQueryBuilder('album')
      .leftJoin('album.members', 'member')
      .leftJoin('album.owner', 'owner')
      .where('album.id = :albumId', { albumId })
      .andWhere('(owner.id = :userId OR member.id = :userId)', { userId })
      .getOne();
    return !!album;
  }

  async get(albumId: string) {
    return this.albums.findOne({ where: { id: albumId }, relations: ['owner', 'members'] });
  }

  async listMedia(albumId: string, limit = 50) {
    const album = await this.albums.findOne({ where: { id: albumId }, relations: ['assets', 'assets.owner'] });
    if (!album) throw new Error('Album not found');
    const items = (album.assets || []).sort((a, b) => {
      const bd = b.capturedAt ?? b.createdAt;
      const ad = a.capturedAt ?? a.createdAt;
      return new Date(bd).getTime() - new Date(ad).getTime();
    });
    return items.slice(0, limit);
  }

  async addAsset(albumId: string, assetId: string, requesterId: string) {
    const can = await this.canAccess(albumId, requesterId);
    if (!can) throw new Error('Forbidden');
    const album = await this.albums.findOne({ where: { id: albumId }, relations: ['assets'] });
    if (!album) throw new Error('Album not found');
    const asset = await this.media.findOne({ where: { id: assetId }, relations: ['owner'] });
    if (!asset) throw new Error('Asset not found');
    const exists = (album.assets || []).some((a) => a.id === asset.id);
    if (!exists) {
      album.assets = [...(album.assets || []), asset];
      await this.albums.save(album);
    }
    return album;
  }

  async removeAsset(albumId: string, assetId: string, requesterId: string) {
    const can = await this.canAccess(albumId, requesterId);
    if (!can) throw new Error('Forbidden');
    const album = await this.albums.findOne({ where: { id: albumId }, relations: ['assets'] });
    if (!album) throw new Error('Album not found');
    album.assets = (album.assets || []).filter((a) => a.id !== assetId);
    await this.albums.save(album);
    return album;
  }

  async hasAccessToAsset(userId: string, assetId: string): Promise<boolean> {
    const qb = this.albums
      .createQueryBuilder('album')
      .innerJoin('album.assets', 'asset')
      .leftJoin('album.members', 'member')
      .leftJoin('album.owner', 'owner')
      .where('asset.id = :assetId', { assetId })
      .andWhere('(owner.id = :userId OR member.id = :userId)', { userId });
    const found = await qb.getOne();
    return !!found;
  }

  async getAlbumsForAsset(assetId: string) {
    return this.albums
      .createQueryBuilder('album')
      .innerJoin('album.assets', 'asset')
      .where('asset.id = :assetId', { assetId })
      .select(['album.id', 'album.name', 'album.createdAt'])
      .getMany();
  }

  async detachAssetFromAll(assetId: string) {
    const albums = await this.albums
      .createQueryBuilder('album')
      .innerJoin('album.assets', 'asset')
      .where('asset.id = :assetId', { assetId })
      .select(['album.id'])
      .getMany();
    for (const a of albums) {
      await this.albums
        .createQueryBuilder()
        .relation(Album, 'assets')
        .of(a.id)
        .remove(assetId);
    }
    return { count: albums.length };
  }
}
