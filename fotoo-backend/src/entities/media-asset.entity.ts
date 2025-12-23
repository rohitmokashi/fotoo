import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'media_assets' })
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.assets, { nullable: false })
  owner: User;

  @Column()
  bucket: string;

  @Column({ unique: true })
  key: string;

  @Column()
  mimeType: string;

  @Column('bigint')
  size: string; // store as string for bigint

  // Processed/derived variant stored after background conversion
  @Column({ nullable: true })
  processedKey?: string;

  @Column({ nullable: true })
  processedMimeType?: string;

  @Column('bigint', { nullable: true })
  processedSize?: string | null;

  // Processing lifecycle: pending -> processing -> processed | failed
  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'processing' | 'processed' | 'failed';

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
  @Column({ type: 'timestamptz', nullable: true })
  capturedAt?: Date;
}
