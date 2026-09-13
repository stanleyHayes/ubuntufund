import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrganizationTeamPage } from '@/pages/OrganizationTeamPage'
import { api } from '@/lib/api'
const auth = vi.hoisted(() => ({ user: { id: 'owner' } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'owner' } })
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

it('keeps a held identity draft and sends optional screening permission only when chosen', async () => {
  vi.mocked(api.get).mockImplementation(async path => path.startsWith('/publication-reviews') ? { items: [], total: 0 } : path.endsWith('/mine') ? [{ organizationId: 'org', name: 'Foundation', role: 'owner', status: 'active' }] : { name: 'Foundation', website: '', role: 'owner', members: [], campaigns: [] })
  vi.mocked(api.put).mockRejectedValue(new Error('Saved privately for safety review.'))
  render(<OrganizationTeamPage />)
  const name = await screen.findByLabelText('Organization name')
  fireEvent.change(name, { target: { value: 'Proposed foundation' } })
  fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'https://proposed.example.test' } })
  const consent = screen.getByRole('checkbox', { name: /Use OpenAI/ })
  expect(consent).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Save organization details' }))
  await screen.findByText('Saved privately for safety review.')
  expect(name).toHaveValue('Proposed foundation')
  expect(api.put).toHaveBeenLastCalledWith('/organization-team/org/profile', { organizationName: 'Proposed foundation', website: 'https://proposed.example.test', automatedReviewConsent: false })
  fireEvent.click(consent)
  fireEvent.click(screen.getByRole('button', { name: 'Save organization details' }))
  await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/organization-team/org/profile', expect.objectContaining({ automatedReviewConsent: true })))
})
it('isolates a pending identity save from a switched account and never reloads using its credentials', async () => {
  vi.mocked(api.get).mockImplementation(async path => path.endsWith('/mine') ? [{ organizationId: auth.user.id, name: auth.user.id, role: 'owner', status: 'active' }] : { name: auth.user.id, website: '', role: 'owner', members: [], campaigns: [] })
  let finish!: (value: unknown) => void
  vi.mocked(api.put).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = render(<OrganizationTeamPage />)
  fireEvent.change(await screen.findByLabelText('Organization name'), { target: { value: 'Old account draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save organization details' }))
  auth.user = { id: 'second-account' }
  view.rerender(<OrganizationTeamPage />)
  await waitFor(() => expect(screen.getByLabelText('Organization name')).toHaveValue('second-account'))
  const reads = vi.mocked(api.get).mock.calls.length
  finish({ updated: true })
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(api.get).toHaveBeenCalledTimes(reads)
  expect(screen.queryByText('Organization profile updated.')).not.toBeInTheDocument()
})
