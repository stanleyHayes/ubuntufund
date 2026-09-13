import type { UserEntity } from '../../entities/User.js';
import type { ProfileEntity, NotificationPreferences } from '../../entities/Profile.js';

export interface AccountProfileChanges {
  automatedReviewConsent?: boolean;
  name?: string;
  avatarUrl?: string;
  coverUrl?: string;
  phone?: string;
  bio?: string;
  country?: string;
  notificationPreferences?: Partial<NotificationPreferences>;
  preferredCurrency?: string;
  language?: string;
  darkMode?: boolean;
  anonymousDonations?: boolean;
  showLeaderboards?: boolean;
  publicProfile?: boolean;
}

/** Atomic, authenticated patches preserve fields omitted from a profile/settings request. */
export interface AccountProfileWritePort {
  write(userId: string, changes: AccountProfileChanges, authVersion: string): Promise<{ user: UserEntity; profile: ProfileEntity }>;
}
