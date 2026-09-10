import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSignupPlans } from '@/hooks/useSubscription'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
describe('signup pricing', () => {
 it('loads current public annual prices without authenticated defaults', async () => {
  vi.mocked(api.get).mockResolvedValue([{ tier: 'enterprise', priceMonthly: 99.99, priceYearly: 999 }])
  const { result } = renderHook(() => useSignupPlans())
  expect(result.current.plans).toEqual({})
  await waitFor(() => expect(result.current.plans.enterprise.priceYearly).toBe(999))
  expect(api.get).toHaveBeenCalledWith('/plans/public')
 })
 it('does not offer stale prices when live pricing fails', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Offline'))
  const { result } = renderHook(() => useSignupPlans())
  await waitFor(() => expect(result.current.error).toBe(true))
  expect(result.current.plans).toEqual({})
 })
})
