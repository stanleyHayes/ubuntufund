import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProfileImageEditor } from '@/components/profile/ProfileImageEditor'
import { api } from '@/lib/api'
import { publicationDraftKey, writePublicationDraft } from '@/lib/publicationDrafts'
import { installMemoryStorage } from '../memoryStorage'
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('@ubuntu-fund/ui', async original => ({ ...await original<typeof import('@ubuntu-fund/ui')>(), ImageUpload: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <input aria-label="Selected image" value={value} onChange={event => onChange(event.target.value)} /> }))
beforeEach(() => {
  vi.resetAllMocks()
  installMemoryStorage()
  vi.mocked(api.get).mockResolvedValue({ items: [], total: 0 })
  vi.stubGlobal('Image', class { onload?: () => void; set src(_value: string) { queueMicrotask(() => this.onload?.()) } })
})
afterEach(() => vi.unstubAllGlobals())
/** What the API client throws for a change held for safety review. */
const held = () => Object.assign(new Error('Saved privately for safety review.'), { status: 409, errors: { publication: ['held'] } })
/** …and for one its approval publishes by itself. */
const heldAutomatically = () => Object.assign(new Error('Saved privately for safety review.'), { status: 409, errors: { publication: ['held', 'publishes_on_approval'] } })
const AVATAR_DRAFT = publicationDraftKey('profile-avatarUrl', 'owner')
/** Held is an expected step: an info status notice, never a red alert. */
async function expectHeldNotice() {
  const notice = (await screen.findByText('Waiting for safety review')).closest('[role="status"]')
  expect(notice).toHaveClass('MuiAlert-colorInfo')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
}
it('retains held media and calls onSaved only after the same image is accepted', async () => {
  const saved = vi.fn()
  vi.mocked(api.put).mockRejectedValueOnce(held()).mockResolvedValueOnce({})
  render(<ProfileImageEditor kind="avatarUrl" currentUrl="" onClose={() => {}} onSaved={saved} />)
  fireEvent.change(screen.getByLabelText('Selected image'), { target: { value: 'https://example.test/proposed.png' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save image' }))
  await expectHeldNotice()
  expect(saved).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Selected image')).toHaveValue('https://example.test/proposed.png')
  expect(screen.getByRole('button', { name: 'Refresh publication reviews' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save image' }))
  await waitFor(() => expect(saved).toHaveBeenCalledExactlyOnceWith('https://example.test/proposed.png'))
  expect(vi.mocked(api.put).mock.calls).toEqual([['/profile', { avatarUrl: 'https://example.test/proposed.png' }], ['/profile', { avatarUrl: 'https://example.test/proposed.png' }]])
})
it('does not submit with another account credentials when image validation finishes after unmount', async () => {
  let loaded!: () => void
  vi.stubGlobal('Image', class { onload?: () => void; set src(_value: string) { loaded = () => this.onload?.() } })
  const view = render(<ProfileImageEditor kind="coverUrl" currentUrl="https://example.test/new.png" onClose={() => {}} onSaved={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save image' }))
  view.unmount(); loaded()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(api.put).not.toHaveBeenCalled()
})
it('keeps a held image across closing the dialog and clears it once the same image is accepted', async () => {
  const saved = vi.fn()
  vi.mocked(api.put).mockRejectedValueOnce(held()).mockResolvedValueOnce({})
  const first = render(<ProfileImageEditor kind="avatarUrl" currentUrl="" onClose={() => {}} onSaved={saved} />)
  fireEvent.change(screen.getByLabelText('Selected image'), { target: { value: 'https://example.test/held.png' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save image' }))
  await expectHeldNotice()
  first.unmount()
  // Reopened later: the held URL is restored rather than lost to a re-upload.
  render(<ProfileImageEditor kind="avatarUrl" currentUrl="" onClose={() => {}} onSaved={saved} />)
  expect(screen.getByLabelText('Selected image')).toHaveValue('https://example.test/held.png')
  expect(screen.getByText(/This is the image you last submitted/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save image' }))
  await waitFor(() => expect(saved).toHaveBeenCalledExactlyOnceWith('https://example.test/held.png'))
  expect(localStorage.length).toBe(0)
})
it('removes an image by saving the default without a held draft', async () => {
  const saved = vi.fn()
  vi.mocked(api.put).mockResolvedValueOnce({})
  render(<ProfileImageEditor kind="coverUrl" currentUrl="https://example.test/current.png" onClose={() => {}} onSaved={saved} />)
  expect(screen.getByText(/takes effect right away/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Use default image' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save image' }))
  await waitFor(() => expect(saved).toHaveBeenCalledExactlyOnceWith(''))
  expect(api.put).toHaveBeenCalledWith('/profile', { coverUrl: '' })
  expect(localStorage.length).toBe(0)
})

it('says a held image goes live once approved, and when reopened says so only if it is still waiting', async () => {
  vi.mocked(api.put).mockRejectedValueOnce(heldAutomatically())
  const first = render(<ProfileImageEditor kind="avatarUrl" currentUrl="" onClose={() => {}} onSaved={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Selected image'), { target: { value: 'https://example.test/proposed.png' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save image' }))
  await expectHeldNotice()
  expect(screen.getByText(/Once a reviewer approves it, it's published automatically/)).toBeInTheDocument()
  first.unmount()
  // Kept in case it couldn't be published, so it can be saved again without a new upload.
  render(<ProfileImageEditor kind="avatarUrl" currentUrl="" onClose={() => {}} onSaved={vi.fn()} />)
  expect(screen.getByLabelText('Selected image')).toHaveValue('https://example.test/proposed.png')
  // It may have been declined, withdrawn or replaced since: the note doesn't promise it goes live.
  expect(screen.getByText("This is the image you last submitted. If it's still waiting for review, it goes live automatically once approved. If it couldn't be published, save it again.")).toBeInTheDocument()
})
it('forgets a held image once it is the live one', () => {
  writePublicationDraft(AVATAR_DRAFT, { url: 'https://example.test/approved.png', publishesOnApproval: true })
  render(<ProfileImageEditor kind="avatarUrl" currentUrl="https://example.test/approved.png" onClose={() => {}} onSaved={vi.fn()} />)
  expect(screen.queryByText(/This is the image you last submitted/)).not.toBeInTheDocument()
  expect(localStorage.length).toBe(0)
})
it('restores an image held before publishing on approval, with what to do after approval', () => {
  writePublicationDraft(AVATAR_DRAFT, 'https://example.test/older.png')
  render(<ProfileImageEditor kind="avatarUrl" currentUrl="" onClose={() => {}} onSaved={vi.fn()} />)
  expect(screen.getByLabelText('Selected image')).toHaveValue('https://example.test/older.png')
  expect(screen.getByText('This is the image you last submitted. If it is waiting for review, save it again after it is approved.')).toBeInTheDocument()
})
