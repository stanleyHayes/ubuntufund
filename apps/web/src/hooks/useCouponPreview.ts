import { useCallback, useEffect, useRef, useState } from 'react'
import type { CouponPreview, CouponValidationInput } from '@ubuntu-fund/types'
import { previewCoupon } from '@/lib/coupons'

// ---------------------------------------------------------------------------
// useCouponPreview
//
// Debounced coupon quoting for the checkout form. `run()` schedules a preview
// after the user stops typing; a `reqId` counter (the imperative equivalent of
// useSubscription's `cancelled` flag) guards against out-of-order responses so
// a stale request can never overwrite a newer one. `clear()` resets to a clean
// state and invalidates any in-flight request.
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 400

/**
 * Whatever the preview endpoint accepts, which differs per surface: a
 * subscription quotes against a plan, a donation against a campaign's platform
 * fee. The debounce and the out-of-order guard below are identical either way,
 * so they are shared rather than duplicated per screen.
 */
type CouponPreviewArgs = CouponValidationInput

interface UseCouponPreviewResult {
  preview: CouponPreview | null
  loading: boolean
  error: string | null
  run: (args: CouponPreviewArgs) => void
  clear: () => void
}

export function useCouponPreview(): UseCouponPreviewResult {
  const [preview, setPreview] = useState<CouponPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped on every run/clear; a resolved request is applied only when its id
  // still matches — otherwise it's been superseded and is dropped.
  const reqIdRef = useRef(0)

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    reqIdRef.current += 1
    setPreview(null)
    setLoading(false)
    setError(null)
  }, [])

  const clear = useCallback(() => {
    reset()
  }, [reset])

  const run = useCallback((args: CouponPreviewArgs) => {
    const code = args.code.trim()

    // Empty code — reset without hitting the API.
    if (!code) {
      reset()
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    const reqId = ++reqIdRef.current
    setLoading(true)
    setError(null)

    timerRef.current = setTimeout(() => {
      previewCoupon({ ...args, code })
        .then((result) => {
          if (reqId !== reqIdRef.current) return // superseded
          setPreview(result)
        })
        .catch((err: unknown) => {
          if (reqId !== reqIdRef.current) return
          setPreview(null)
          setError(err instanceof Error ? err.message : 'Could not check this coupon')
        })
        .finally(() => {
          if (reqId === reqIdRef.current) setLoading(false)
        })
    }, DEBOUNCE_MS)
  }, [reset])

  // Cancel any pending debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { preview, loading, error, run, clear }
}
