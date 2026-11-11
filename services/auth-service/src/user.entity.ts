import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type Role = 'USER' | 'BUSINESS' | 'ADMIN';

export interface ReaderPreferences {
  size: 16 | 18 | 20 | 22;
  font: 'sans' | 'serif';
  theme: 'day' | 'paper' | 'slate' | 'night';
  spacing: 'comfortable' | 'compact';
}

@Entity('users')
@Index('users_oidc_sub_unique', ['oidcSub'], { unique: true, where: 'oidc_sub IS NOT NULL' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'oidc_sub', type: 'varchar', nullable: true })
  oidcSub: string | null;

  @Column({ type: 'varchar', length: 10, default: 'USER' })
  role: Role;

  @Column({ name: 'business_status', default: 'NONE' })
  businessStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ default: '' })
  organization: string;

  @Column({ name: 'business_website', default: '' })
  businessWebsite: string;

  @Column({ name: 'business_reason', type: 'text', default: '' })
  businessReason: string;

  @Column({ name: 'review_note', type: 'text', default: '' })
  reviewNote: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ default: false })
  disabled: boolean;

  @Column({ name: 'reader_preferences', type: 'jsonb', default: () => "'{}'" })
  readerPreferences: Partial<ReaderPreferences>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
