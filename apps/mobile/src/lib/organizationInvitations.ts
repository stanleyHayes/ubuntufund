/** A row from GET /organization-team/mine. */
export interface OrganizationMembership {
  organizationId: string
  name?: string
  role: string
  status: string
  invitationId?: string
}

/** Open invitations this account can accept (the API already drops expired ones). */
export function pendingOrganizationInvitations(rows: unknown): (OrganizationMembership & { invitationId: string })[] {
  if (!Array.isArray(rows)) return []
  return rows.filter((row): row is OrganizationMembership & { invitationId: string } =>
    !!row && typeof row === 'object' && (row as OrganizationMembership).status === 'invited' && typeof (row as OrganizationMembership).invitationId === 'string')
}

/** Accounts that run or administer an organization manage the team on the website. */
export function managesOrganizationTeam(rows: unknown): boolean {
  return Array.isArray(rows) && rows.some(row => !!row && typeof row === 'object' && (row as OrganizationMembership).status === 'active' && ['owner', 'admin'].includes((row as OrganizationMembership).role))
}

export function organizationTeamUrl(origin = process.env.EXPO_PUBLIC_WEB_URL || 'https://app.ujimora.com'): string {
  return new URL('/organization-team', origin).toString()
}
