import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MediaAsset } from './media-asset.entity.js';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'varchar', default: 'user' })
  role: 'user' | 'admin';

  @OneToMany(() => MediaAsset, (asset: MediaAsset) => asset.owner)
  assets: MediaAsset[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
