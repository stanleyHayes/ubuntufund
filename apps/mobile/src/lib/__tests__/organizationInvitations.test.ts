import { expect, it } from 'vitest'
import { managesOrganizationTeam, organizationTeamUrl, pendingOrganizationInvitations } from '../organizationInvitations'

const rows = [
  { organizationId: 'own', name: 'My org', role: 'owner', status: 'active' },
  { organizationId: 'o1', name: 'Tamale Water Trust', role: 'editor', status: 'invited', invitationId: 'inv-1' },
  { organizationId: 'o2', name: 'Member org', role: 'viewer', status: 'active', invitationId: 'inv-2' },
]

it('lists only open organization invitations the account can accept', () => {
  expect(pendingOrganizationInvitations(rows).map(row => row.invitationId)).toEqual(['inv-1'])
  expect(pendingOrganizationInvitations(null)).toEqual([])
  expect(pendingOrganizationInvitations([{ status: 'invited' }])).toEqual([])
})

it('sends owners and admins to the website to manage the team', () => {
  expect(managesOrganizationTeam(rows)).toBe(true)
  expect(managesOrganizationTeam([rows[1], rows[2]])).toBe(false)
  expect(organizationTeamUrl('https://app.ujimora.com')).toBe('https://app.ujimora.com/organization-team')
})
