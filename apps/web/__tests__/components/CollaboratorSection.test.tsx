import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CollaborationStatus, CollaboratorRole, type CampaignCollaborator } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn(), delete: vi.fn() } }))
import { CollaboratorSection } from '@/components/campaigns/CollaboratorSection'

const accepted: CampaignCollaborator = {
  id: 'c1', campaignId: 'camp', userId: 'u1', invitedBy: 'owner', role: CollaboratorRole.EDITOR, status: CollaborationStatus.ACCEPTED,
  revenueSharePercent: 25, displayName: 'Ama Mensah', createdAt: new Date(), updatedAt: new Date(),
}
beforeEach(() => { vi.mocked(api.post).mockReset() })

it('describes roles as listing labels and never shows or collects an unpaid revenue share', async () => {
  vi.mocked(api.post).mockResolvedValue(null)
  render(<CollaboratorSection campaignId="camp" isOwner collaborators={[accepted]} />)
  expect(screen.getByText('Ama Mensah')).toBeInTheDocument()
  expect(screen.queryByText(/revenue share/i)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Invite Collaborator/i }))
  expect(await screen.findByText('Listed on the campaign as an editor. Campaign changes are made by the owner.')).toBeInTheDocument()
  expect(screen.queryByLabelText(/Revenue Share/i)).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'someone@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/campaigns/camp/collaborators/invite', { userEmail: 'someone@example.test', role: CollaboratorRole.EDITOR, revenueSharePercent: 0, inviteMessage: undefined }))
  expect(await screen.findByText('If that email belongs to a Ujimora account, they have been invited.')).toBeInTheDocument()
})
