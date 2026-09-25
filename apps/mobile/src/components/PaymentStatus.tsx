import { DONATION_CONTENT_REVIEW_MESSAGES, type DonationContentReviewStatus } from '@ubuntu-fund/types'
import { DonationCelebration } from './DonationCelebration'
import { useCallback, useEffect, useState, useRef } from 'react'
import { AppState, View } from 'react-native'
import { Text } from 'react-native-paper'
import * as WebBrowser from 'expo-web-browser'
import { api } from '@/lib/api'
import { canStartOver, isPaymentSuccess, isPaymentTerminal, type PendingPayment } from '@/lib/payments'
import { Button, Skeleton } from './Loading'
import { usePalette, useNeu } from '@/context/ColorModeContext'

type PaymentStatusProps = { payment: PendingPayment; topup?: boolean; onComplete?: () => void; onReset: () => void; onStatusChange?: (status: string) => void }

export function PaymentStatus(props: PaymentStatusProps) {
  // The component owns isolation even when its caller does not provide a key.
  return <PaymentStatusContent key={JSON.stringify([props.topup ?? false, props.payment.id, props.payment.reference])} {...props} />
}

function PaymentStatusContent({ payment, topup = false, onComplete, onReset, onStatusChange }: PaymentStatusProps) {
  const p = usePalette(); const neu = useNeu()
  const alive = useRef(true)
  const generation = useRef(0)
  const inFlight = useRef(false)
  const notified = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current += 1 } }, [])
  const [contentReviewStatus, setContentReviewStatus] = useState<DonationContentReviewStatus>()
  const [status, setStatus] = useState(payment.status)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  // Older saved attempts carry no createdAt: count from when this screen opened.
  const startedAt = useRef(payment.createdAt ?? Date.now())
  const [now, setNow] = useState(() => Date.now())
  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    const ticket = generation.current
    setChecking(true)
    try {
      const result = !topup && payment.reference
        ? await api.post<{ status: string; contentReviewStatus?: DonationContentReviewStatus }>(`/donation-intents/${encodeURIComponent(payment.id)}/verify`, { reference: payment.reference })
        : await api.get<{ status: string; contentReviewStatus?: DonationContentReviewStatus }>(topup ? `/wallets/topups/${encodeURIComponent(payment.id)}` : `/donation-intents/${encodeURIComponent(payment.id)}/public`)
      if (alive.current && ticket === generation.current) { setStatus(result.status); setContentReviewStatus(result.contentReviewStatus); setError('') }
    } catch (e) { if (alive.current && ticket === generation.current) { setContentReviewStatus('unavailable'); setError(e instanceof Error ? e.message : 'Could not check payment status.') } }
    finally { inFlight.current = false; if (alive.current) setChecking(false) }
  }, [payment.id, payment.reference, topup])
  useEffect(() => { void refresh() }, [refresh])
  const success = isPaymentSuccess(status)
  useEffect(() => { if (success && !notified.current) { notified.current = true; onComplete?.() } }, [success, onComplete])
  useEffect(() => { onStatusChange?.(status) }, [status, onStatusChange])
  useEffect(() => {
    if (isPaymentTerminal(status)) return
    void refresh()
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh() }, 5000)
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh() })
    return () => { clearInterval(timer); listener.remove() }
  }, [refresh, status])
  useEffect(() => {
    if (isPaymentTerminal(status)) return
    const clock = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(clock)
  }, [status])
  const offerStartOver = canStartOver(status, startedAt.current, now)
  // A top-up the provider reported failed can still complete in the same
  // checkout (a declined card retried, a late mobile-money approval). For a
  // while, re-check whenever the payer returns to the app; the server credits
  // a verified success even after 'failed'.
  const recheckFailedTopup = topup && status === 'failed' && now - startedAt.current < 30 * 60 * 1000
  useEffect(() => {
    if (!recheckFailedTopup) return
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh() })
    return () => listener.remove()
  }, [recheckFailedTopup, refresh])
  return <View style={{ ...neu.raised, backgroundColor: p.surface, padding: 20, borderRadius: 24, gap: 12 }}>
    {success && !topup && <DonationCelebration />}
    <Text variant="titleLarge">{success ? (topup ? 'Wallet funded' : 'Thank you for your support') : isPaymentTerminal(status) ? 'Payment was not completed' : 'Awaiting payment confirmation'}</Text>
    {!isPaymentTerminal(status) && <><Skeleton height={12} /><Text>Your balance updates only after provider confirmation. Closing checkout does not confirm or cancel a payment.</Text></>}
    <Text selectable>Reference: {payment.id}</Text><Text>Status: {status}</Text>
    {success && !topup && contentReviewStatus && DONATION_CONTENT_REVIEW_MESSAGES[contentReviewStatus] ? <Text>{DONATION_CONTENT_REVIEW_MESSAGES[contentReviewStatus]}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    {!isPaymentTerminal(status) && <>
      {payment.authorizationUrl?.startsWith('https://') && <Button mode="outlined" onPress={() => void WebBrowser.openBrowserAsync(payment.authorizationUrl!)}>Open secure checkout</Button>}
      <Button loading={checking} disabled={checking} onPress={() => void refresh()}>Check status</Button>
      {offerStartOver && <>
        <Text>Still not confirmed? If you already paid, don't pay again: that payment will still be confirmed once the provider reports it.</Text>
        <Button mode="text" onPress={onReset}>Start a new payment</Button>
      </>}
    </>}
    {success && !topup && <Button loading={checking} disabled={checking} onPress={() => void refresh()}>Refresh content review</Button>}
    {isPaymentTerminal(status) && <Button mode="contained" onPress={onReset}>{success ? 'Make another payment' : 'Try again'}</Button>}
  </View>
}
