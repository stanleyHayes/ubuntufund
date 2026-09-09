import { useCallback, useEffect, useState, useRef } from 'react'
import { AppState, View } from 'react-native'
import { Text } from 'react-native-paper'
import * as WebBrowser from 'expo-web-browser'
import { api } from '@/lib/api'
import { isPaymentSuccess, isPaymentTerminal, type PendingPayment } from '@/lib/payments'
import { Button, Skeleton } from './Loading'
import { usePalette, useNeu } from '@/context/ColorModeContext'

export function PaymentStatus({ payment, topup = false, onComplete, onReset, onStatusChange }: { payment: PendingPayment; topup?: boolean; onComplete?: () => void; onReset: () => void; onStatusChange?: (status: string) => void }) {
  const p = usePalette(); const neu = useNeu()
  const alive = useRef(true)
  const generation = useRef(0)
  const inFlight = useRef(false)
  const notified = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current += 1 } }, [])
  const [status, setStatus] = useState(payment.status)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    const ticket = generation.current
    setChecking(true)
    try {
      const result = await api.get<{ status: string }>(topup ? `/wallets/topups/${encodeURIComponent(payment.id)}` : `/donation-intents/${encodeURIComponent(payment.id)}/public`)
      if (alive.current && ticket === generation.current) { setStatus(result.status); setError('') }
    } catch (e) { if (alive.current && ticket === generation.current) setError(e instanceof Error ? e.message : 'Could not check payment status.') }
    finally { inFlight.current = false; if (alive.current) setChecking(false) }
  }, [payment.id, topup])
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
  return <View style={{ ...neu.raised, backgroundColor: p.surface, padding: 20, borderRadius: 24, gap: 12 }}>
    <Text variant="titleLarge">{success ? (topup ? 'Wallet funded' : 'Thank you for your support') : isPaymentTerminal(status) ? 'Payment was not completed' : 'Awaiting payment confirmation'}</Text>
    {!isPaymentTerminal(status) && <><Skeleton height={12} /><Text>Your balance updates only after provider confirmation. Closing checkout does not confirm or cancel a payment.</Text></>}
    <Text selectable>Reference: {payment.id}</Text><Text>Status: {status}</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    {!isPaymentTerminal(status) && <>
      {payment.authorizationUrl?.startsWith('https://') && <Button mode="outlined" onPress={() => void WebBrowser.openBrowserAsync(payment.authorizationUrl!)}>Open secure checkout</Button>}
      <Button loading={checking} disabled={checking} onPress={() => void refresh()}>Check status</Button>
    </>}
    {isPaymentTerminal(status) && <Button mode="contained" onPress={onReset}>{success ? 'Make another payment' : 'Try again'}</Button>}
  </View>
}
