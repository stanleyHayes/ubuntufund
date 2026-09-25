import { useRef, useState } from 'react'
import { Alert, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import { usePalette } from '@/context/ColorModeContext'
import {
  deleteAccount,
  loadAccountClosureCheck,
  loadMfaEnabled,
  openCampaignsWarning,
  type AccountClosureCheck,
} from '@/lib/accountClosure'
import { BrandedTextInput as TextInput } from './BrandedTextInput'
import { Button } from './Loading'
import { TouchableRipple } from './RoundedControls'

/**
 * In-app account deletion. The API requires the current password (plus an
 * authenticator or recovery code when MFA is on) and refuses while balances or
 * payouts are outstanding; this section explains both before the user commits.
 */
export function DeleteAccountSection({ rowStyle, textStyle, onDeleted }: {
  rowStyle: object
  textStyle: object
  onDeleted: () => Promise<void> | void
}) {
  const p = usePalette()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [check, setCheck] = useState<AccountClosureCheck | null>(null)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  async function begin() {
    setOpen(true); setLoading(true); setError(''); setPassword(''); setCode('')
    const [closure, mfa] = await Promise.all([loadAccountClosureCheck(), loadMfaEnabled()])
    setCheck(closure); setMfaEnabled(mfa); setLoading(false)
  }

  async function submit() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setError('')
    try {
      await deleteAccount(password, code)
      await onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account. Please try again.')
      // A balance or payout that appeared since the preview: show the current reasons.
      if ((err as { status?: number }).status === 409) setCheck(await loadAccountClosureCheck())
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  function confirm() {
    Alert.alert('Delete your account?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void submit() },
    ])
  }

  if (!open) {
    return (
      <TouchableRipple style={rowStyle} rippleColor={`${p.error}1A`} onPress={() => void begin()}>
        <>
          <Icon source="delete-outline" size={20} color={p.error} />
          <Text style={textStyle}>Delete Account</Text>
        </>
      </TouchableRipple>
    )
  }

  const blocked = check?.canClose === false
  const needsCode = mfaEnabled || /authenticator code/i.test(error)
  const warning = blocked ? null : openCampaignsWarning(check)
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={textStyle}>Delete Account</Text>
      <Text>
        This immediately closes your account and signs you out. Financial and safety records may be retained where required by law, fraud prevention, or an active dispute. An App Store or Google Play subscription is not cancelled automatically; cancel it in your store subscription settings to stop renewal.
      </Text>
      {loading && <Text>Checking your balances and campaigns…</Text>}
      {blocked && !!check?.message && <Text accessibilityRole="alert" style={{ color: p.error }}>{check.message}</Text>}
      {!!warning && <Text accessibilityRole="alert" style={{ color: p.warningText }}>{warning}</Text>}
      {!blocked && !loading && <>
        <TextInput label="Current password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} disabled={busy} />
        {needsCode && <TextInput label="Authenticator or recovery code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} disabled={busy} />}
      </>}
      {!!error && error !== check?.message && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}
      <Button
        mode="contained"
        buttonColor={p.error}
        disabled={busy || loading || blocked || !password || (needsCode && code.trim().length < 6)}
        onPress={confirm}
      >
        {busy ? 'Deleting…' : 'Delete my account'}
      </Button>
      <Button disabled={busy} onPress={() => setOpen(false)}>Cancel</Button>
    </View>
  )
}
