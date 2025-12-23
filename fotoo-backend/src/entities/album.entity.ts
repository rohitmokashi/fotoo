import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { MediaAsset } from './media-asset.entity';

@Entity({ name: 'albums' })
export class Album {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => User, { nullable: false })
  owner: User;

  @ManyToMany(() => User)
  @JoinTable({ name: 'album_members' })
  members: User[];

  @ManyToMany(() => MediaAsset)
  @JoinTable({ name: 'album_assets' })
  assets: MediaAsset[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
