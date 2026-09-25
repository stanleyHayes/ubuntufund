import { endLiveSession, startLiveSession } from '@/lib/fundraising'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignLivePage } from '@/pages/CampaignLivePage'
import { ColorModeProvider } from '@/context/ColorModeContext'
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
const mocks = vi.hoisted(() => ({ active: null as any, videoEnabled: false }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(async (path: string) => path.startsWith('/publication-reviews') ? { items: [], total: 0 } : path.endsWith('/active') ? mocks.active : path.endsWith('/video/config') ? { enabled: mocks.videoEnabled } : { id: 'campaign', creatorId: 'owner', title: 'Community campaign', raisedAmount: 250, goalAmount: 5000, currency: 'GHS' }) } }))
vi.mock('@/hooks/useLiveTotals', () => ({ useLiveTotals: () => ({ raisedAmount: 250, goalAmount: 5000, donations: [], connected: false }) }))
vi.mock('@/components/live/LiveVideoPanel', () => ({ LiveVideoPanel: () => <div>Host video controls</div> }))
vi.mock('@/components/live/QrCodeManager', () => ({ QrCodeManager: () => null }))
vi.mock('@/components/LiveDonationFeed', () => ({ LiveDonationFeed: () => null }))
const session = { id: 'session', campaignId: 'campaign', status: 'active', overlayToken: 'test-token', showDonorNames: true, showDonorMessages: true, showAmounts: true, privacyMode: false }
vi.mock('@/lib/fundraising', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/fundraising')>(), startLiveSession: vi.fn(async () => session), endLiveSession: vi.fn(async () => ({ ...session, status: 'ended' })) }))
beforeEach(() => {
  vi.mocked(startLiveSession).mockReset().mockResolvedValue(session as any)
  vi.mocked(endLiveSession).mockReset().mockResolvedValue({ ...session, status: 'ended' } as never)
  const storage = () => { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key), clear: () => data.clear() } }
  vi.stubGlobal('localStorage', storage()); vi.stubGlobal('sessionStorage', storage());
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); mocks.active = null; mocks.videoEnabled = false
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const mount = () => render(<ColorModeProvider><MemoryRouter initialEntries={['/campaigns/campaign/live']}><Routes><Route path="/campaigns/:id/live" element={<CampaignLivePage />} /></Routes></MemoryRouter></ColorModeProvider>)
describe('live broadcast workspace', () => {
  it.each(['neumorphism', 'claymorphism', 'glassmorphism', 'minimal'])('uses the saved %s appearance and prevents unconfigured video starts', async skin => {
    localStorage.setItem('uf_skin', skin); mount()
    await screen.findByText('Your broadcast canvas')
    expect(document.documentElement.dataset.skin).toBe(skin)
    expect(document.documentElement.style.getPropertyValue('--neu-raised')).not.toBe('')
    await screen.findByText(/In-app broadcasting is awaiting/)
    // findBy, not getBy: the button reads 'Checking session…' until the session
    // lookup resolves, and that request is independent of the video-config one
    // behind the text above — so whichever settles first varies per run.
    expect(await screen.findByRole('button', { name: 'Go LIVE' })).toBeDisabled()
    expect(screen.getByTitle('Broadcast preview')).toHaveAttribute('src', expect.stringContaining('preview=1'))
  })
  it('preserves a held title and sends automated review consent only after selection', async () => {
    mocks.videoEnabled = true
    vi.mocked(startLiveSession).mockRejectedValueOnce(new Error('Saved privately for safety review.'))
    mount()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Go LIVE' })).toBeEnabled())
    const consent = screen.getByRole('checkbox', { name: /Use OpenAI to check/ })
    expect(consent).not.toBeChecked()
    fireEvent.change(screen.getByLabelText('Session title (optional)'), { target: { value: 'My held broadcast' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go LIVE' }))
    await screen.findByText('Saved privately for safety review.')
    expect(screen.getByLabelText('Session title (optional)')).toHaveValue('My held broadcast')
    expect(startLiveSession).toHaveBeenLastCalledWith('campaign', expect.objectContaining({ title: 'My held broadcast', automatedReviewConsent: false }))
    fireEvent.click(consent)
    fireEvent.click(screen.getByRole('button', { name: 'Go LIVE' }))
    await screen.findByText('Host video controls')
    expect(startLiveSession).toHaveBeenLastCalledWith('campaign', expect.objectContaining({ title: 'My held broadcast', automatedReviewConsent: true }))
  })
  it('starts video-ready sessions and recovers controls from the server after remount', async () => {
    mocks.videoEnabled = true; const view = mount()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Go LIVE' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Go LIVE' }))
    await screen.findByText('Host video controls')
    expect((screen.getByLabelText('Viewer link') as HTMLInputElement).value).toContain('/live/session')
    view.unmount(); mocks.active = session; mount()
    await screen.findByText('Host video controls')
    expect(screen.getByTitle('Broadcast preview').getAttribute('src')).not.toContain('preview=1')
  })
  it('asks before ending the broadcast for everyone', async () => {
    mocks.videoEnabled = true; mocks.active = session; mount()
    fireEvent.click(await screen.findByRole('button', { name: 'End session' }))
    const dialog = await screen.findByRole('dialog', { name: 'End broadcast?' })
    expect(dialog).toHaveTextContent('This closes the live session for viewers.')
    expect(endLiveSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(endLiveSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'End session' }))
    fireEvent.click(await screen.findByRole('button', { name: 'End broadcast' }))
    await waitFor(() => expect(endLiveSession).toHaveBeenCalledTimes(1))
    expect(endLiveSession).toHaveBeenCalledWith('session')
    await screen.findByRole('button', { name: 'Go LIVE' })
  })
  it('explains that hiding amounts keeps the campaign progress bar visible', async () => {
    mocks.videoEnabled = true; mocks.active = session; mount()
    await screen.findByText(/Hiding amounts hides each gift’s amount and this broadcast’s total/)
  })
})
