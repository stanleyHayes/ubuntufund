import { useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native-paper'
import { usePalette } from '@/context/ColorModeContext'
import { endSession, unlockBiometricSession } from '@/lib/session'
import { BiometricUnlockError } from '@/lib/unlockError'
import { Button } from './Loading'
import { UjimoraLogo } from './UjimoraLogo'
export function BiometricLock({ suspended = false }: { suspended?: boolean }) {
  const p = usePalette(), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function act(password: boolean) {
    setBusy(true); setError('')
    try { if (password) await endSession(); else await unlockBiometricSession() }
    // Explain known outcomes (expired unlock, changed biometrics, no connection); keep raw native errors generic.
    catch (e) { setError(e instanceof BiometricUnlockError ? e.message : 'Could not unlock. Try again, or sign in with your password and authenticator if enabled.') }
    finally { setBusy(false) }
  }
  return <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 20, backgroundColor: p.background }} accessibilityViewIsModal>
    <UjimoraLogo size={44} /><Text variant="headlineMedium">Ujimora is locked</Text>
    <Text>Use your device biometrics to unlock your account. Your fingerprint or face data stays on your device.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}
    <Button mode="contained" disabled={busy || suspended} onPress={() => void act(false)}>{busy ? 'Please wait…' : 'Unlock with biometrics'}</Button>
    <Button disabled={suspended} onPress={() => void act(true)}>Sign in with password instead</Button>
  </View>
}
