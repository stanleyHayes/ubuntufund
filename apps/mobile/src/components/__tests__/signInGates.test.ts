import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'

const m = vi.hoisted(() => ({ push: vi.fn(), user: null as null | { id: string }, pathname: '/refund-request', params: {} as Record<string, string>, segments: ['refund-request'] as string[] }))
vi.mock('expo-router', () => ({
  router: { push: m.push, replace: vi.fn(), back: vi.fn(), dismissTo: vi.fn() },
  usePathname: () => m.pathname,
  useGlobalSearchParams: () => m.params,
  useSegments: () => m.segments,
}))
vi.mock('react-native', () => ({
  View: ({ children }: { children: React.ReactNode }) => createElement('div', {}, children),
  ScrollView: ({ children }: { children: React.ReactNode }) => createElement('div', {}, children),
  StyleSheet: { create: <T,>(styles: T) => styles },
}))
vi.mock('react-native-paper', () => {
  const Dialog = Object.assign(({ children, visible }: { children: React.ReactNode; visible: boolean }) => visible ? createElement('div', { role: 'dialog' }, children) : null, {
    Title: ({ children }: { children: React.ReactNode }) => createElement('h2', {}, children),
    ScrollArea: ({ children }: { children: React.ReactNode }) => createElement('div', {}, children),
    Actions: ({ children }: { children: React.ReactNode }) => createElement('div', {}, children),
  })
  return { Text: 'span', Icon: () => null, Portal: ({ children }: { children: React.ReactNode }) => children, Dialog }
})
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: m.user }) }))
vi.mock('../Loading', () => ({ Button: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled }, children) }))
vi.mock('../BrandedTextInput', () => ({ BrandedTextInput: ({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) => createElement('textarea', { 'aria-label': label, value, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChangeText(event.target.value) }) }))
vi.mock('../SelectionField', () => ({ SelectionField: ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) => createElement('select', { 'aria-label': label, value, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value) }, [createElement('option', { key: '', value: '' }, 'Choose'), ...options.map(o => createElement('option', { key: o.value, value: o.value }, o.label))]) }))

import { SignInRequired } from '../SignInRequired'
import { ReportCampaign } from '../ReportCampaign'

beforeEach(() => { vi.clearAllMocks(); m.user = null; m.pathname = '/refund-request'; m.params = {}; m.segments = ['refund-request'] })
afterEach(cleanup)

it('sends the user to sign in with the gated screen and its query as returnTo', () => {
  m.params = { donationId: 'abc123' }
  render(createElement(SignInRequired, { what: 'refunds' }))
  fireEvent.click(screen.getByText('Sign In'))
  expect(m.push).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { returnTo: '/refund-request?donationId=abc123' } })
})

it('leaves route segments such as [id] out of the returnTo query', () => {
  m.pathname = '/campaign/abc'; m.params = { id: 'abc' }; m.segments = ['campaign', '[id]']
  render(createElement(SignInRequired, {}))
  fireEvent.click(screen.getByText('Sign In'))
  expect(m.push).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { returnTo: '/campaign/abc' } })
})

it('asks signed-out viewers to sign in before reporting and hides reporting from the creator', () => {
  const { unmount } = render(createElement(ReportCampaign, { campaignId: 'camp1', creatorId: 'creator' }))
  fireEvent.click(screen.getByText('Sign in to report this campaign'))
  expect(m.push).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { returnTo: '/campaign/camp1' } })
  unmount()
  m.user = { id: 'creator' }
  render(createElement(ReportCampaign, { campaignId: 'camp1', creatorId: 'creator' }))
  expect(screen.queryByText(/report/i)).toBeNull()
})

it('lets a signed-in viewer choose a valid reason and shows the server error', async () => {
  m.user = { id: 'viewer' }
  render(createElement(ReportCampaign, { campaignId: 'camp1', creatorId: 'creator' }))
  fireEvent.click(screen.getByText('Report Campaign'))
  const send = screen.getByText('Send report') as HTMLButtonElement
  expect(send.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'fraudulent' } })
  fireEvent.change(screen.getByLabelText('Additional details (optional)'), { target: { value: ' Fake receipts ' } })
  vi.mocked(api.post).mockRejectedValueOnce(new Error('You have already reported this campaign'))
  fireEvent.click(screen.getByText('Send report'))
  expect(await screen.findByText('You have already reported this campaign')).toBeTruthy()
  expect(api.post).toHaveBeenCalledWith('/campaigns/camp1/report', { reason: 'fraudulent', description: 'Fake receipts' })
  vi.mocked(api.post).mockResolvedValueOnce(null)
  fireEvent.click(screen.getByText('Send report'))
  await waitFor(() => expect(screen.getByText('Thank you. Our team will review this campaign.')).toBeTruthy())
  expect(screen.queryByRole('dialog')).toBeNull()
})
