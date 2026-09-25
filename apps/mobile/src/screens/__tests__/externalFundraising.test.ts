import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ openURL: vi.fn(async () => true), campaign: null as null | Record<string, unknown> }))
vi.mock('react-native', () => ({
  Linking: { openURL: m.openURL },
  ScrollView: ({ children }: { children: React.ReactNode }) => createElement('div', {}, children),
}))
vi.mock('react-native-paper', () => ({ Text: 'span' }))
vi.mock('expo-router', () => ({ Stack: { Screen: () => null }, useLocalSearchParams: () => ({ id: 'a'.repeat(24), amount: '20' }) }))
vi.mock('@/hooks/useCampaigns', () => ({ useCampaign: () => ({ campaign: m.campaign, isLoading: false, error: null }) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}) }))
vi.mock('@/components/Loading', () => ({ PageSkeleton: () => null, Button: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled }, children) }))
import ExternalFundraisingScreen from '../ExternalFundraisingScreen'
const future = new Date(Date.now() + 7 * 86_400_000).toISOString()
beforeEach(() => { m.openURL.mockClear() })
afterEach(cleanup)

it('hands a legacy campaign without a slug to the website by id', async () => {
  m.campaign = { id: 'a'.repeat(24), title: 'Clinic roof', status: 'active', endDate: future }
  render(createElement(ExternalFundraisingScreen))
  fireEvent.click(screen.getByText('Continue in browser'))
  await waitFor(() => expect(m.openURL).toHaveBeenCalledTimes(1))
  const url = new URL(m.openURL.mock.calls[0][0] as string)
  expect(url.pathname).toBe(`/c/${'a'.repeat(24)}/donate`)
  expect(url.searchParams.get('amount')).toBe('20')
})

it('describes only what the donation website offers', () => {
  m.campaign = { id: 'b'.repeat(24), slug: 'clinic-roof', title: 'Clinic roof', status: 'active', endDate: future }
  render(createElement(ExternalFundraisingScreen))
  expect(screen.getByText(/pay by card or mobile money/)).toBeTruthy()
  expect(screen.getByText(/sign in on the website with this account before you pay/)).toBeTruthy()
  expect(screen.queryByText(/wallet/i)).toBeNull()
  expect(screen.queryByText(/review fees/i)).toBeNull()
})

it('still refuses closed campaigns', () => {
  m.campaign = { id: 'c'.repeat(24), title: 'Done', status: 'completed', endDate: future }
  render(createElement(ExternalFundraisingScreen))
  expect(screen.queryByText('Continue in browser')).toBeNull()
  expect(screen.getByText('This campaign is not accepting donations right now.')).toBeTruthy()
})
