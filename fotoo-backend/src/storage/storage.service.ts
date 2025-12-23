import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const forcePathStyle = this.config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';
    this.bucket = this.config.get<string>('S3_BUCKET', 'fotoo-dev');

    this.s3 = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  getBucket() {
    return this.bucket;
  }

  async getUploadUrl(key: string, contentType: string, expiresInSeconds = 900) {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.s3, cmd, { expiresIn: expiresInSeconds });
  }

  async getDownloadUrl(key: string, expiresInSeconds = 900) {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, cmd, { expiresIn: expiresInSeconds });
  }

  async deleteObject(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getObjectStream(key: string): Promise<{ body: Readable; contentType?: string }> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = res.Body as unknown as Readable;
    const contentType = res.ContentType;
    return { body, contentType };
  }

  async putObjectBuffer(key: string, buffer: Buffer, contentType?: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }));
  }

  async downloadToTempFile(key: string): Promise<{ path: string; contentType?: string }> {
    const { body, contentType } = await this.getObjectStream(key);
    const tmpPath = join(tmpdir(), `fotoo-${randomUUID()}`);
    const write = await fs.open(tmpPath, 'w');
    await new Promise<void>((resolve, reject) => {
      (body as Readable)
        .on('error', reject)
        .pipe(write.createWriteStream())
        .on('error', reject)
        .on('finish', () => resolve());
    });
    await write.close();
    return { path: tmpPath, contentType };
  }
}
