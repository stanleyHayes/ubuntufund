import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { campaignUpdatePayload } from '@/lib/campaignUpdates'

const m = vi.hoisted(() => ({ refresh: vi.fn(), alert: vi.fn(), user: { id: 'owner' } as { id: string } | null }))
const { el } = vi.hoisted(() => ({ el: (tag: string) => ({ children }: { children?: React.ReactNode }) => createElement(tag, {}, children) }))
vi.mock('react-native', () => ({
  View: el('div'), ScrollView: el('div'), StyleSheet: { create: <T,>(styles: T) => styles },
  Alert: { alert: m.alert },
}))
vi.mock('react-native-paper', () => {
  const Dialog = Object.assign(({ children, visible }: { children: React.ReactNode; visible: boolean }) => visible ? createElement('div', { role: 'dialog' }, children) : null, { Title: el('h2'), ScrollArea: el('div'), Actions: el('div') })
  return {
    Text: 'span', Icon: () => null, Surface: el('div'), Avatar: { Text: () => null }, Portal: ({ children }: { children: React.ReactNode }) => children, Dialog,
    Checkbox: { Item: ({ label, onPress }: { label: string; onPress: () => void }) => createElement('button', { onClick: onPress }, label) },
  }
})
vi.mock('@/hooks/usePublicRead', () => ({ usePublicRead: () => ({ data: [
  { id: 'u1', campaignId: 'c1', authorId: 'owner', title: 'Roof done', content: 'We finished the roof.', type: 'milestone', mediaUrls: [], isPinned: false, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
], loading: false, error: null, refresh: m.refresh }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: m.user }) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}), useNeu: () => ({}) }))
vi.mock('@/components/RoundedControls', () => ({ TouchableOpacity: el('div') }))
vi.mock('@/components/ReportContent', () => ({ ReportContent: () => null }))
vi.mock('@/components/Chip', () => ({ Chip: el('span') }))
vi.mock('@/components/RemoteImage', () => ({ RemoteImage: () => null }))
vi.mock('@/components/anim/FadeInUp', () => ({ FadeInUp: el('div') }))
vi.mock('@/components/EmptyState', () => ({ EmptyState: ({ title }: { title: string }) => createElement('p', {}, title) }))
vi.mock('@/components/PublicationConsent', () => ({ PublicationConsent: () => null }))
vi.mock('@/components/SelectionField', () => ({ SelectionField: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => createElement('input', { 'aria-label': label, value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }) }))
vi.mock('@/components/BrandedTextInput', () => ({ BrandedTextInput: ({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) => createElement('textarea', { 'aria-label': label, value, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChangeText(e.target.value) }) }))
vi.mock('@/components/Loading', () => ({ SkeletonLoader: () => null, Button: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled }, children) }))
import { CampaignUpdatesList } from '../CampaignUpdatesList'
beforeEach(() => { vi.clearAllMocks(); m.user = { id: 'owner' }; vi.mocked(api.post).mockResolvedValue({}); vi.mocked(api.delete).mockResolvedValue(null) })
afterEach(cleanup)

describe('campaign update owner controls', () => {
  it('are hidden from supporters', () => {
    m.user = { id: 'supporter' }
    render(createElement(CampaignUpdatesList, { campaignId: 'c1', isCreator: false }))
    expect(screen.getByText('Roof done')).toBeTruthy()
    expect(screen.queryByText('Post an update')).toBeNull()
    expect(screen.queryByText('Pin')).toBeNull()
    expect(screen.queryByText('Delete')).toBeNull()
  })

  it('let the owner post an update and refresh the list', async () => {
    render(createElement(CampaignUpdatesList, { campaignId: 'c1', isCreator: true }))
    fireEvent.click(screen.getByText('Post an update'))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Halfway there ' } })
    fireEvent.change(screen.getByLabelText('Update'), { target: { value: 'Thank you all.' } })
    fireEvent.change(screen.getByLabelText('Update type'), { target: { value: 'thank_you' } })
    fireEvent.click(screen.getByText('Pin this update to the top'))
    fireEvent.click(screen.getByText('Post update'))
    await waitFor(() => expect(m.refresh).toHaveBeenCalled())
    expect(api.post).toHaveBeenCalledWith('/campaigns/c1/updates', { title: 'Halfway there', content: 'Thank you all.', type: 'thank_you', isPinned: true, automatedReviewConsent: false })
    expect(screen.getByText('Update posted.')).toBeTruthy()
  })

  it('show publication-review errors from the server in the composer', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('This update is waiting for staff review.'))
    render(createElement(CampaignUpdatesList, { campaignId: 'c1', isCreator: true }))
    fireEvent.click(screen.getByText('Post an update'))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Halfway there' } })
    fireEvent.change(screen.getByLabelText('Update'), { target: { value: 'Thank you all.' } })
    fireEvent.click(screen.getByText('Post update'))
    expect(await screen.findByText('This update is waiting for staff review.')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(m.refresh).not.toHaveBeenCalled()
  })

  it('let the owner pin and, after confirming, delete an update', async () => {
    render(createElement(CampaignUpdatesList, { campaignId: 'c1', isCreator: true }))
    fireEvent.click(screen.getByText('Pin'))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/campaigns/c1/updates/u1/pin'))
    fireEvent.click(screen.getByText('Delete'))
    expect(api.delete).not.toHaveBeenCalled()
    const buttons = m.alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]
    buttons.find(b => b.text === 'Delete')!.onPress!()
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/campaigns/c1/updates/u1'))
    await waitFor(() => expect(m.refresh).toHaveBeenCalledTimes(2))
  })
})

describe('campaign update payload', () => {
  it('matches the API limits', () => {
    const base = { title: 'Roof', content: 'Done', type: 'general', isPinned: false, automatedReviewConsent: true }
    expect(campaignUpdatePayload(base)).toEqual({ title: 'Roof', content: 'Done', type: 'general', isPinned: false, automatedReviewConsent: true })
    expect(() => campaignUpdatePayload({ ...base, title: 'ab' })).toThrow('between 3 and 200')
    expect(() => campaignUpdatePayload({ ...base, content: ' ' })).toThrow('5,000')
    expect(() => campaignUpdatePayload({ ...base, content: 'x'.repeat(5001) })).toThrow('5,000')
    expect(() => campaignUpdatePayload({ ...base, type: 'announcement' })).toThrow('update type')
  })
})
