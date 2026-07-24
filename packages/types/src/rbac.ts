// ─── Resources ───────────────────────────────────────────────────────────────
// Every entity in the system that can be permissioned.

export enum Resource {
  CAMPAIGNS = 'campaigns',
  USERS = 'users',
  DONATIONS = 'donations',
  DISPUTES = 'disputes',
  REPORTS = 'reports',
  VERIFICATIONS = 'verifications',
  SUBSCRIPTIONS = 'subscriptions',
  PLANS = 'plans',
  SETTINGS = 'settings',
  AUDIT_LOG = 'audit_log',
  ROLES = 'roles',
  WALLETS = 'wallets',
  COMMENTS = 'comments',
  NOTIFICATIONS = 'notifications',
  ANALYTICS = 'analytics',
  ORGANIZATIONS = 'organizations',
  NEWSLETTER = 'newsletter',
  CONTACT_SUBMISSIONS = 'contact_submissions',
  TESTIMONIALS = 'testimonials',
  PAYMENT_PROVIDERS = 'payment_providers',
  AI_WRITER = 'ai_writer',
  CONTENT = 'content',
}

// ─── Actions ─────────────────────────────────────────────────────────────────
// CRUD + special actions. Read is always required for any other action.

export enum Action {
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

// ─── Permission String ───────────────────────────────────────────────────────
// Format: "resource:action" e.g. "campaigns:read", "users:delete"

export type PermissionString = `${Resource}:${Action}`

/** Build a permission string */
export function perm(resource: Resource, action: Action): PermissionString {
  return `${resource}:${action}`
}

/** Parse a permission string */
export function parsePerm(p: PermissionString): { resource: Resource; action: Action } {
  const [resource, action] = p.split(':') as [Resource, Action]
  return { resource, action }
}

// ─── Role ────────────────────────────────────────────────────────────────────

export interface Role {
  id: string
  name: string
  slug: string
  description: string
  /** The base permission set for this role */
  permissions: PermissionString[]
  /** Whether this is a system role that cannot be deleted */
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateRoleInput {
  name: string
  description: string
  permissions: PermissionString[]
}

export interface UpdateRoleInput {
  name?: string
  description?: string
  permissions?: PermissionString[]
}

// ─── User Permissions ────────────────────────────────────────────────────────
// A user gets the role's permissions at creation, then can be individually tweaked.

export interface UserPermissions {
  userId: string
  roleId: string
  roleName: string
  /** The effective permissions for this user (starts as role permissions, can be altered) */
  permissions: PermissionString[]
  /** Permissions added beyond the role baseline */
  grantedExtras: PermissionString[]
  /** Permissions revoked from the role baseline */
  revokedFromRole: PermissionString[]
  updatedAt: Date
}

// ─── Invite ──────────────────────────────────────────────────────────────────

export interface InviteUserInput {
  email: string
  name: string
  password?: string
  roleId: string
  /** Country — defaults to 'Ghana'; the platform operates in Ghana only */
  country?: string
  organizationName?: string
}

// ─── Default Roles ───────────────────────────────────────────────────────────

export const DEFAULT_ROLES: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    description: 'Full platform access. Can manage roles, users, and all settings.',
    isSystem: true,
    permissions: Object.values(Resource).flatMap((r) =>
      Object.values(Action).map((a) => perm(r, a))
    ),
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Platform administration with most permissions. Cannot manage roles.',
    isSystem: true,
    permissions: Object.values(Resource)
      .filter((r) => r !== Resource.ROLES)
      .flatMap((r) => Object.values(Action).map((a) => perm(r, a))),
  },
  {
    name: 'Moderator',
    slug: 'moderator',
    description: 'Can review campaigns, disputes, reports, and verifications.',
    isSystem: true,
    permissions: [
      perm(Resource.CAMPAIGNS, Action.READ), perm(Resource.CAMPAIGNS, Action.UPDATE),
      perm(Resource.USERS, Action.READ),
      perm(Resource.DONATIONS, Action.READ),
      perm(Resource.DISPUTES, Action.READ), perm(Resource.DISPUTES, Action.UPDATE),
      perm(Resource.REPORTS, Action.READ), perm(Resource.REPORTS, Action.UPDATE),
      perm(Resource.VERIFICATIONS, Action.READ), perm(Resource.VERIFICATIONS, Action.UPDATE),
      perm(Resource.COMMENTS, Action.READ), perm(Resource.COMMENTS, Action.DELETE),
      perm(Resource.AUDIT_LOG, Action.READ),
      perm(Resource.ANALYTICS, Action.READ),
    ],
  },
  {
    name: 'Organization',
    slug: 'organization',
    description: 'Organization account. Can manage own campaigns and view donations.',
    isSystem: true,
    permissions: [
      perm(Resource.CAMPAIGNS, Action.READ), perm(Resource.CAMPAIGNS, Action.CREATE), perm(Resource.CAMPAIGNS, Action.UPDATE),
      perm(Resource.DONATIONS, Action.READ),
      perm(Resource.WALLETS, Action.READ),
      perm(Resource.COMMENTS, Action.READ), perm(Resource.COMMENTS, Action.CREATE),
      perm(Resource.NOTIFICATIONS, Action.READ),
      perm(Resource.ANALYTICS, Action.READ),
      perm(Resource.ORGANIZATIONS, Action.READ), perm(Resource.ORGANIZATIONS, Action.UPDATE),
      perm(Resource.SUBSCRIPTIONS, Action.READ),
    ],
  },
  {
    name: 'User',
    slug: 'user',
    description: 'Regular platform user. Can create campaigns, donate, and manage own data.',
    isSystem: true,
    permissions: [
      perm(Resource.CAMPAIGNS, Action.READ), perm(Resource.CAMPAIGNS, Action.CREATE),
      perm(Resource.DONATIONS, Action.READ), perm(Resource.DONATIONS, Action.CREATE),
      perm(Resource.WALLETS, Action.READ),
      perm(Resource.COMMENTS, Action.READ), perm(Resource.COMMENTS, Action.CREATE),
      perm(Resource.NOTIFICATIONS, Action.READ),
      perm(Resource.SUBSCRIPTIONS, Action.READ),
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check if a permission set includes a specific permission */
export function hasPermission(
  permissions: PermissionString[],
  resource: Resource,
  action: Action
): boolean {
  return permissions.includes(perm(resource, action))
}

/**
 * Validate that write permissions include read.
 * Returns cleaned permission set with read auto-added where needed.
 */
export function normalizePermissions(perms: PermissionString[]): PermissionString[] {
  const set = new Set(perms)
  for (const p of perms) {
    const { resource, action } = parsePerm(p)
    if (action !== Action.READ) {
      // Any write action requires read
      set.add(perm(resource, Action.READ))
    }
  }
  return Array.from(set).sort()
}

/**
 * Compute effective permissions from a role baseline + granted extras - revoked.
 */
export function computeEffectivePermissions(
  rolePermissions: PermissionString[],
  grantedExtras: PermissionString[],
  revokedFromRole: PermissionString[]
): PermissionString[] {
  const set = new Set(rolePermissions)
  for (const p of grantedExtras) set.add(p)
  for (const p of revokedFromRole) set.delete(p)
  return normalizePermissions(Array.from(set))
}

/** Get all possible permission strings */
export function getAllPermissions(): PermissionString[] {
  return Object.values(Resource).flatMap((r) =>
    Object.values(Action).map((a) => perm(r, a))
  )
}
