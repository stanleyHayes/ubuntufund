import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CampaignComments } from '@/components/campaigns/CampaignComments'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), post: vi.fn() } }))
const auth = vi.hoisted(() => ({ user: { id: 'viewer' } as { id: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'viewer' } })
it('blocks a commenter, removes their comments and supports unblocking with a reload', async () => {
  let blocked = false
  const comment = { id: 'comment', authorId: 'author', authorName: 'Alex', content: 'A comment', createdAt: new Date().toISOString() }
  vi.mocked(api.get).mockImplementation(async path => path === '/safety/blocks' ? { items: blocked ? [{ id: 'author', name: 'Alex' }] : [] } : { items: blocked ? [] : [comment] })
  vi.mocked(api.put).mockImplementation(async () => { blocked = true; return null })
  vi.mocked(api.delete).mockImplementation(async () => { blocked = false; return null })
  render(<ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="owner" /></ThemeProvider>)
  await screen.findByText('A comment')
  fireEvent.click(screen.getByRole('button', { name: 'Block Alex' }))
  await waitFor(() => expect(screen.queryByText('A comment')).toBeNull())
  expect(api.put).toHaveBeenCalledWith('/safety/blocks/author', {})
  fireEvent.click(await screen.findByRole('button', { name: 'Unblock Alex' }))
  await screen.findByText('A comment')
  expect(api.delete).toHaveBeenCalledWith('/safety/blocks/author')
})

it('immediately clears viewer-specific comments on logout, even when the guest request fails', async () => {
  const comment = { id: 'private-comment', authorId: 'owner', authorName: 'Organizer', content: 'Private preparation notes', createdAt: new Date().toISOString() }
  vi.mocked(api.get).mockImplementation(async path => path === '/safety/blocks' ? { items: [] } : { items: [comment] })
  const tree = () => <ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="owner" /></ThemeProvider>
  const view = render(tree())
  await screen.findByText('Private preparation notes')
  auth.user = null
  vi.mocked(api.get).mockRejectedValue(new Error('Campaign not found'))
  view.rerender(tree())
  expect(screen.queryByText('Private preparation notes')).toBeNull()
  await screen.findByText('Campaign not found')
  expect(screen.queryByText('Private preparation notes')).toBeNull()
})

it('clears previously visible comments when focus refresh fails', async () => {
  auth.user = null
  vi.mocked(api.get).mockResolvedValue({ items: [{ id: 'comment', authorId: 'author', authorName: 'Alex', content: 'Previously visible', createdAt: new Date().toISOString() }] })
  render(<ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="owner" /></ThemeProvider>)
  await screen.findByText('Previously visible')
  vi.mocked(api.get).mockRejectedValue(new Error('Moderation evidence unavailable'))
  fireEvent.focus(window)
  await screen.findByText('Moderation evidence unavailable')
  expect(screen.queryByText('Previously visible')).toBeNull()
})

it('ignores a pending pre-block response after a successful block', async () => {
  const comment = { id: 'comment', authorId: 'author', authorName: 'Alex', content: 'Do not restore this comment', createdAt: new Date().toISOString() }
  let finish!: (value: unknown) => void
  let pending = false
  vi.mocked(api.get).mockImplementation(path => {
    if (path === '/safety/blocks') return Promise.resolve({ items: [] })
    if (pending) return new Promise(resolve => { finish = resolve })
    return Promise.resolve({ items: [comment] })
  })
  vi.mocked(api.put).mockResolvedValue(null)
  render(<ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="owner" /></ThemeProvider>)
  await screen.findByText(comment.content)
  pending = true
  fireEvent.focus(window)
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('button', { name: 'Block Alex' }))
  await waitFor(() => expect(screen.queryByText(comment.content)).toBeNull())
  await act(async () => finish({ items: [comment] }))
  await waitFor(() => expect(screen.queryByText(comment.content)).toBeNull())
})
