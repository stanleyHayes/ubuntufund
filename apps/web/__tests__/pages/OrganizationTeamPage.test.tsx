import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrganizationTeamPage } from '@/pages/OrganizationTeamPage'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
describe('organization workspace permissions', () => {
 it('shows the organization name and owner management controls', async () => {
  vi.mocked(api.get).mockImplementation(async path => path.endsWith('/mine') ? [{ organizationId: 'org', name: 'Foundation', role: 'owner', status: 'active' }] : { name: 'Foundation', website: '', role: 'owner', members: [], campaigns: [] })
  render(<OrganizationTeamPage />)
  expect(await screen.findByText('Invite a teammate')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create invitation' })).toBeInTheDocument()
  expect(screen.getByLabelText('Organization name')).toHaveValue('Foundation')
 })
 it('keeps a viewer read-only', async () => {
  vi.mocked(api.get).mockImplementation(async path => path.endsWith('/mine') ? [{ organizationId: 'org', name: 'Foundation', role: 'viewer', status: 'active' }] : { name: 'Foundation', website: '', role: 'viewer', members: [], campaigns: [{ id: 'campaign', title: 'Community support' }] })
  render(<OrganizationTeamPage />)
  expect(await screen.findByRole('link', { name: 'Community support' })).toHaveAttribute('href', '/campaigns/campaign')
  expect(screen.queryByRole('button', { name: 'Create invitation' })).not.toBeInTheDocument()
  expect(screen.queryByText('Publish a campaign update')).not.toBeInTheDocument()
 })
})
