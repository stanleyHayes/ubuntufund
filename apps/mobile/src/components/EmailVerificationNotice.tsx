import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native-paper'
import { usePalette } from '@/context/ColorModeContext'
import { loadEmailVerification, requestVerificationLink, shouldPromptVerification, type EmailVerificationStatus } from '@/lib/emailVerification'
import { Button } from './Loading'

/** Payouts, bank or mobile-money withdrawals and organization invitations need a verified email address. */
export function EmailVerificationNotice() {
  const p = usePalette()
  const [status, setStatus] = useState<EmailVerificationStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void loadEmailVerification().then(value => { if (active) setStatus(value) })
    return () => { active = false }
  }, [])
  if (!shouldPromptVerification(status)) return null
  async function send() {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await requestVerificationLink()
      if (result.verified) setStatus(previous => previous && { ...previous, emailVerified: true })
      else setMessage(result.message)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send a verification link. Please try again.') }
    finally { setBusy(false) }
  }
  return <View style={{ marginHorizontal: 16, marginTop: 12, padding: 12, gap: 8, borderRadius: 12, backgroundColor: `${p.primary}14` }}>
    <Text style={{ color: p.text }}>Verify your email address. Payouts and withdrawals to a bank or mobile-money account, and organization invitations, need a verified email.</Text>
    {!!message && <Text accessibilityRole="alert" style={{ color: p.success }}>{message}</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}
    <Button disabled={busy} onPress={() => void send()}>{busy ? 'Sending…' : 'Send verification link'}</Button>
  </View>
}
