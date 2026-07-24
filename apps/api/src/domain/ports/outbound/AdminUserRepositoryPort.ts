import type { UserRole, VerificationLevel } from '@ubuntu-fund/types';

// Admin user listing is a read-model over the User collection — it exposes a
// flatter, admin-facing shape (role/verification/trustScore front and
// center) rather than round-tripping through UserEntity, mirroring how
// LeaderboardRepositoryPort reads User/Donation records directly for its own
// read-model instead of reusing UserRepositoryPort.
export interface AdminUserListParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  verificationLevel: VerificationLevel;
  trustScore: number;
  country?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserRepositoryPort {
  listUsers(
    params: AdminUserListParams
  ): Promise<{ items: AdminUserRecord[]; total: number }>;
}
