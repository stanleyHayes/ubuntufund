import type { ProfileEntity } from '../../entities/Profile.js';

export interface ProfileRepositoryPort {
  save(profile: ProfileEntity): Promise<ProfileEntity>;
  findByUserId(userId: string): Promise<ProfileEntity | null>;
  update(profile: ProfileEntity): Promise<ProfileEntity>;
}
