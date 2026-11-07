import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

export const PERMISSIONS = ['content.exclusive', 'content.manage', 'assets.download', 'candidates.view'] as const;
export type Permission = typeof PERMISSIONS[number];
export const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  USER: ['assets.download'],
  BUSINESS: ['content.exclusive', 'assets.download'],
  ADMIN: [...PERMISSIONS],
};

@Entity('role_policies')
export class RolePolicy {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  role: string;

  @Column({ type: 'jsonb' })
  permissions: Permission[];
}

@Entity('access_audit')
export class AccessAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'uuid' })
  actor: string;
  @Column()
  action: string;
  @Column()
  target: string;
  @Column({ type: 'jsonb' })
  details: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
