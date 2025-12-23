import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Album } from '../entities/album.entity';
import { User } from '../entities/user.entity';
import { MediaAsset } from '../entities/media-asset.entity';
import { AlbumsService } from './albums.service';
import { AlbumsController } from './albums.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Album, User, MediaAsset]), StorageModule],
  providers: [AlbumsService],
  controllers: [AlbumsController],
  exports: [AlbumsService],
})
export class AlbumsModule {}
