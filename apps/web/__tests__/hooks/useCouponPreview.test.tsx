import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { BillingCycle } from '@ubuntu-fund/types'
import { useCouponPreview } from '@/hooks/useCouponPreview'
import { previewCoupon } from '@/lib/coupons'
vi.mock('@/lib/coupons', () => ({ previewCoupon: vi.fn() }))

const quote = (code: string, finalAmount: number) =>
  ({ valid: true, code, baseAmount: 29.99, discountAmount: 29.99 - finalAmount, finalAmount, currency: 'GHS' })
const pro = (code: string, billingCycle = BillingCycle.MONTHLY) => ({ code, tier: 'pro', billingCycle })

beforeEach(() => { vi.useFakeTimers(); vi.mocked(previewCoupon).mockReset() })
afterEach(() => { vi.useRealTimers() })

describe('coupon quotes belong to the inputs they were priced for', () => {
  it('drops the previous code\'s quote as soon as another code is being quoted', async () => {
    vi.mocked(previewCoupon).mockResolvedValueOnce(quote('SAVE50', 14.99)).mockImplementationOnce(() => new Promise(() => {}))
    const { result } = renderHook(() => useCouponPreview())
    act(() => result.current.run(pro('SAVE50')))
    await act(async () => { await vi.advanceTimersByTimeAsync(450) })
    expect(result.current.preview).toMatchObject({ code: 'SAVE50', finalAmount: 14.99 })
    // The member edits the code; SAVE5's quote is slow to come back.
    act(() => result.current.run(pro('SAVE5')))
    expect(result.current.preview).toBeNull()
    expect(result.current.loading).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(450) })
    expect(result.current.preview).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('drops it when the billing cycle changes, too', async () => {
    vi.mocked(previewCoupon).mockResolvedValueOnce(quote('SAVE10', 26.99)).mockImplementationOnce(() => new Promise(() => {}))
    const { result } = renderHook(() => useCouponPreview())
    act(() => result.current.run(pro('SAVE10')))
    await act(async () => { await vi.advanceTimersByTimeAsync(450) })
    expect(result.current.preview).toMatchObject({ finalAmount: 26.99 })
    act(() => result.current.run(pro('SAVE10', BillingCycle.YEARLY)))
    expect(result.current.preview).toBeNull()
  })

  it('keeps the quote when only the code\'s letter case changes, as the server matches codes that way', async () => {
    vi.mocked(previewCoupon).mockResolvedValueOnce(quote('SAVE10', 26.99)).mockImplementationOnce(() => new Promise(() => {}))
    const { result } = renderHook(() => useCouponPreview())
    act(() => result.current.run(pro('save10')))
    await act(async () => { await vi.advanceTimersByTimeAsync(450) })
    act(() => result.current.run(pro('SAVE10 ')))
    expect(result.current.preview).toMatchObject({ finalAmount: 26.99 })
  })

  it('never applies a superseded answer that arrives late', async () => {
    let answerFirst: (value: unknown) => void = () => {}
    vi.mocked(previewCoupon)
      .mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve }) as never)
      .mockResolvedValueOnce(quote('SAVE5', 28.49))
    const { result } = renderHook(() => useCouponPreview())
    act(() => result.current.run(pro('SAVE50')))
    await act(async () => { await vi.advanceTimersByTimeAsync(450) })
    act(() => result.current.run(pro('SAVE5')))
    await act(async () => { await vi.advanceTimersByTimeAsync(450) })
    expect(result.current.preview).toMatchObject({ code: 'SAVE5', finalAmount: 28.49 })
    await act(async () => { answerFirst(quote('SAVE50', 14.99)) })
    expect(result.current.preview).toMatchObject({ code: 'SAVE5', finalAmount: 28.49 })
    expect(result.current.loading).toBe(false)
  })
})
