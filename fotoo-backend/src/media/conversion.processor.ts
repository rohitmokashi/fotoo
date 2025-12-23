import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { ConversionService } from './conversion.service';

@Processor('media-processing')
@Injectable()
export class ConversionProcessor {
  constructor(private readonly conversion: ConversionService) {}

  @Process('convert-asset')
  async handle(job: Job<{ assetId: string }>) {
    const { assetId } = job.data;
    await this.conversion.processAsset(assetId);
  }
}
