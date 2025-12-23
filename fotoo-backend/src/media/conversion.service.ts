import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaAsset } from '../entities/media-asset.entity';
import { StorageService } from '../storage/storage.service';
import { randomUUID } from 'crypto';
import { basename, join } from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import sharp from 'sharp';

@Injectable()
export class ConversionService {
  private readonly logger = new Logger(ConversionService.name);
  private readonly mode: 'docker' | 'local' | 'sharp-only';

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    @InjectRepository(MediaAsset) private readonly mediaRepo: Repository<MediaAsset>,
  ) {
    const m = this.config.get<string>('MEDIA_CONVERT_MODE', 'docker');
    this.mode = (m as any) || 'docker';
  }

  private isHeicLike(mime: string, key: string) {
    const lower = (mime || '').toLowerCase();
    return lower.includes('heic') || lower.includes('heif') || /\.hei[cf]$/i.test(key || '');
  }

  private isWebImage(mime: string) {
    return /^image\/(jpeg|jpg|png|webp)$/i.test(mime || '');
  }

  private isMov(mime: string, key: string) {
    return (mime || '').toLowerCase() === 'video/quicktime' || /\.mov$/i.test(key || '');
  }

  private isMp4(mime: string, key: string) {
    return (mime || '').toLowerCase() === 'video/mp4' || /\.mp4$/i.test(key || '');
  }

  private buildProcessedKey(asset: MediaAsset, ext: string) {
    const date = asset.capturedAt || asset.createdAt;
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const base = basename(asset.key).replace(/\.[^.]+$/, '');
    return `${asset.owner.id}/processed/${y}/${m}/${d}/${randomUUID()}_${base}.${ext}`;
  }

  private async runDocker(image: string, args: string[], mounts: { hostPath: string; containerPath: string }[]) {
    return new Promise<void>((resolve, reject) => {
      const dockerArgs = ['run', '--rm', ...mounts.flatMap(m => ['-v', `${m.hostPath}:${m.containerPath}`]), image, ...args];
      const child = spawn('docker', dockerArgs, { stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Docker exited with code ${code}`));
      });
    });
  }

  private async convertHeicToJpegDocker(inputPath: string, outputPath: string) {
    const hostDir = inputPath.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
    const inName = basename(inputPath);
    const outName = basename(outputPath);
    await this.runDocker('ghcr.io/strukturag/libheif:latest', ['heif-convert', `/work/${inName}`, `/work/${outName}`], [
      { hostPath: hostDir, containerPath: '/work' },
    ]);
  }

  private async convertHeicToJpegLocal(inputPath: string, outputPath: string) {
    // Try sharp; requires libvips with libheif
    const buf = await fs.readFile(inputPath);
    const out = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
    await fs.writeFile(outputPath, out);
  }

  private async convertMovToMp4Docker(inputPath: string, outputPath: string) {
    const hostDir = inputPath.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
    const inName = basename(inputPath);
    const outName = basename(outputPath);
    await this.runDocker('jrottenberg/ffmpeg:4.4-alpine', [
      '-i', `/work/${inName}`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-c:a', 'aac', '-movflags', '+faststart',
      `/work/${outName}`,
    ], [{ hostPath: hostDir, containerPath: '/work' }]);
  }

  private async convertMovToMp4Local(inputPath: string, outputPath: string) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('ffmpeg', ['-y', '-i', inputPath, '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', outputPath], { stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
    });
  }

  async processAsset(assetId: string) {
    const asset = await this.mediaRepo.findOne({ where: { id: assetId }, relations: ['owner'] });
    if (!asset) return;
    if (asset.status === 'processing') return;
    asset.status = 'processing';
    asset.error = null;
    await this.mediaRepo.save(asset);
    try {
      const { path: inputPath } = await this.storage.downloadToTempFile(asset.key);
      let outExt = '';
      let outMime = '';
      let needsConversion = false;
      let copyOriginal = false;

      if (this.isHeicLike(asset.mimeType, asset.key)) {
        outExt = 'jpg';
        outMime = 'image/jpeg';
        needsConversion = true;
      } else if (this.isWebImage(asset.mimeType)) {
        // JPEG/PNG/WEBP considered already web-friendly; reuse original
        outExt = asset.key.split('.').pop() || 'jpg';
        outMime = asset.mimeType;
        copyOriginal = true;
      } else if (this.isMov(asset.mimeType, asset.key)) {
        outExt = 'mp4';
        outMime = 'video/mp4';
        needsConversion = true;
      } else if (this.isMp4(asset.mimeType, asset.key)) {
        outExt = 'mp4';
        outMime = 'video/mp4';
        copyOriginal = true;
      } else {
        // Unknown; mark failed but keep original
        throw new Error(`Unsupported mimeType for processing: ${asset.mimeType}`);
      }

      const processedKey = this.buildProcessedKey(asset, outExt);

      if (copyOriginal) {
        // Stream original and upload as processed without re-encoding
        const { body } = await this.storage.getObjectStream(asset.key);
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          (body as any)
            .on('data', (c: Buffer) => chunks.push(c))
            .on('error', reject)
            .on('end', () => resolve());
        });
        const buffer = Buffer.concat(chunks);
        await this.storage.putObjectBuffer(processedKey, buffer, outMime);
        asset.processedKey = processedKey;
        asset.processedMimeType = outMime;
        asset.processedSize = String(buffer.length);
      } else if (needsConversion) {
        const outPath = join(inputPath.replace(/\\/g, '/').replace(/\/[^/]*$/, ''), `out-${randomUUID()}.${outExt}`);
        if (outExt === 'jpg') {
          if (this.mode === 'docker') await this.convertHeicToJpegDocker(inputPath, outPath);
          else await this.convertHeicToJpegLocal(inputPath, outPath);
        } else if (outExt === 'mp4') {
          if (this.mode === 'docker') await this.convertMovToMp4Docker(inputPath, outPath);
          else await this.convertMovToMp4Local(inputPath, outPath);
        }
        const buf = await fs.readFile(outPath);
        await this.storage.putObjectBuffer(processedKey, buf, outMime);
        asset.processedKey = processedKey;
        asset.processedMimeType = outMime;
        asset.processedSize = String(buf.length);
        await fs.unlink(outPath).catch(() => {});
      }

      asset.status = 'processed';
      await this.mediaRepo.save(asset);
      await fs.unlink(inputPath).catch(() => {});
    } catch (e: any) {
      this.logger.error(`Processing failed for ${assetId}: ${e?.message || e}`);
      await this.mediaRepo.update({ id: assetId }, { status: 'failed', error: e?.message || String(e) });
    }
  }
}
