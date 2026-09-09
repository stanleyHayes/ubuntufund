import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignLivePage } from '@/pages/CampaignLivePage'
import { ColorModeProvider } from '@/context/ColorModeContext'
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
const mocks = vi.hoisted(() => ({ active: null as any, videoEnabled: false }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(async (path: string) => path.endsWith('/active') ? mocks.active : path.endsWith('/video/config') ? { enabled: mocks.videoEnabled } : { id: 'campaign', creatorId: 'owner', title: 'Community campaign', raisedAmount: 250, goalAmount: 5000, currency: 'GHS' }) } }))
vi.mock('@/hooks/useLiveTotals', () => ({ useLiveTotals: () => ({ raisedAmount: 250, goalAmount: 5000, donations: [], connected: false }) }))
vi.mock('@/components/live/LiveVideoPanel', () => ({ LiveVideoPanel: () => <div>Host video controls</div> }))
vi.mock('@/components/live/QrCodeManager', () => ({ QrCodeManager: () => null }))
vi.mock('@/components/LiveDonationFeed', () => ({ LiveDonationFeed: () => null }))
const session = { id: 'session', campaignId: 'campaign', status: 'active', overlayToken: 'test-token', showDonorNames: true, showDonorMessages: true, showAmounts: true, privacyMode: false }
vi.mock('@/lib/fundraising', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/fundraising')>(), startLiveSession: vi.fn(async () => session) }))
beforeEach(() => {
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
    expect(screen.getByRole('button', { name: 'Go LIVE' })).toBeDisabled()
    expect(screen.getByTitle('Broadcast preview')).toHaveAttribute('src', expect.stringContaining('preview=1'))
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
})
