import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaAsset } from '../entities/media-asset.entity';
import { User } from '../entities/user.entity';
import { StorageModule } from '../storage/storage.module';
import { AlbumsModule } from '../albums/albums.module';
import { BullModule } from '@nestjs/bull';
import { ConversionService } from './conversion.service';
import { ConversionProcessor } from './conversion.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAsset, User]),
    StorageModule,
    AlbumsModule,
    BullModule.registerQueue({ name: 'media-processing' }),
  ],
  controllers: [MediaController],
  providers: [MediaService, ConversionService, ConversionProcessor],
})
export class MediaModule {}
