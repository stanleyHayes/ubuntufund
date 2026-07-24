import type {
  UserRole,
  VerificationLevel,
  OrganizationType,
} from '@ubuntu-fund/types';

/**
 * Organizations are not a distinct persisted entity — they are User records
 * registered with `role: 'organization'` and an `organizationName`. This is a
 * plain read-model record (no behavior) describing that projection.
 */
export interface OrganizationRecord {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  country?: string;
  role: UserRole;
  verificationLevel: VerificationLevel;
  organizationType?: OrganizationType;
  registrationNumber?: string;
  website?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Derives a URL-friendly slug from an organization's display name.
 * Used to resolve GET /organizations/:slug when the path segment isn't a
 * raw Mongo id.
 */
export function deriveOrganizationSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}
