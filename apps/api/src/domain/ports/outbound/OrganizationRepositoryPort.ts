import type { OrganizationRecord } from '../../entities/Organization.js';

export interface OrganizationRepositoryPort {
  /** All users registered with role=organization. */
  findAll(): Promise<OrganizationRecord[]>;
  findById(id: string): Promise<OrganizationRecord | null>;
  /**
   * Resolves a route param that may be either a Mongo id (what the current
   * frontend always sends) or a human-readable slug derived from the
   * organization's name.
   */
  findBySlugOrId(slugOrId: string): Promise<OrganizationRecord | null>;
}
