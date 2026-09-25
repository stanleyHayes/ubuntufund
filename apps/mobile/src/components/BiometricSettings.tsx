import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Switch, Text } from 'react-native-paper'
import { biometricCapability } from '@/lib/biometricVault'
import { biometricSessionState, disableBiometricSession, enableBiometricSession, lockBiometricSession, observeSession } from '@/lib/session'
import { usePalette } from '@/context/ColorModeContext'
import { Button } from './Loading'
export function BiometricSettings() {
  const p = usePalette(), [capability, setCapability] = useState<{ available: boolean; label: string } | null>(null)
  const [enabled, setEnabled] = useState(biometricSessionState().enabled), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    void biometricCapability().then(value => { if (active) setCapability(value) }).catch(() => { if (active) setCapability({ available: false, label: 'Device biometrics' }) })
    const unsubscribe = observeSession(() => { if (active) setEnabled(biometricSessionState().enabled) })
    return () => { active = false; unsubscribe() }
  }, [])
  async function toggle(value: boolean) {
    setBusy(true); setError(''); setMessage('')
    try { if (value) await enableBiometricSession(); else await disableBiometricSession(); setMessage(value ? 'Biometric unlock enabled on this device.' : 'Biometric unlock disabled on this device.') }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not change biometric unlock.') }
    finally { setBusy(false) }
  }
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <Text variant="titleMedium">{capability?.label ?? 'Device biometrics'}</Text>
    <Text>Optional protection on this device. Your account locks when you leave the app for more than a minute, and you unlock it with supported fingerprint or facial recognition. Biometric unlock lasts 7 days after you turn it on or last sign in with your password; after that, sign in with your password to renew it. You can always sign in with your password and MFA instead.</Text>
    {capability?.available || enabled ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}><Text style={{ flex: 1 }}>{enabled ? 'Enabled on this device' : 'Off'}</Text><Switch accessibilityLabel="Biometric unlock" value={enabled} disabled={busy} onValueChange={value => void toggle(value)} /></View> : <Text>Supported enrolled biometrics are unavailable. Set them up in your device settings, then reopen this page.</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}{!!message && <Text accessibilityRole="alert" style={{ color: p.success }}>{message}</Text>}
    {enabled && <Button disabled={busy} onPress={lockBiometricSession}>Lock now</Button>}
  </View>
}
