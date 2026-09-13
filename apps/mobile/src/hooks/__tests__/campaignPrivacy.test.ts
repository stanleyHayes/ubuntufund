import { act, renderHook, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useCampaign, useCampaigns } from '../useCampaigns'
import { api } from '@/lib/api'
const auth = vi.hoisted(() => ({ user: { id: 'owner', role: 'user' } as { id: string; role: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('expo-router', () => ({ useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]) }))
vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) } }))
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'owner', role: 'user' } })
it('clears owner campaign data when the signed-in account changes and discards late owner responses', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const result = renderHook(() => useCampaign('campaign'))
  auth.user = null
  vi.mocked(api.get).mockRejectedValue(new Error('Campaign not found'))
  result.rerender()
  expect(result.result.current.campaign).toBeNull()
  await waitFor(() => expect(result.result.current.isLoading).toBe(false))
  await act(async () => finish({ id: 'campaign', title: 'Private owner draft' }))
  expect(result.result.current.campaign).toBeNull()
  expect(result.result.current.error).toBe('Campaign not found')
})
it('clears a staff campaign list on logout and on failed reloads', async () => {
  auth.user = { id: 'staff', role: 'admin' }
  vi.mocked(api.get).mockResolvedValue({ items: [{ id: 'draft', title: 'Private campaign' }] })
  const result = renderHook(() => useCampaigns())
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(1))
  auth.user = null
  vi.mocked(api.get).mockRejectedValue(new Error('Connection failed'))
  result.rerender()
  expect(result.result.current.campaigns).toEqual([])
  await waitFor(() => expect(result.result.current.error).toBe('Connection failed'))
  expect(result.result.current.campaigns).toEqual([])
})
