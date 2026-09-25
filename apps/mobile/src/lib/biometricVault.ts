import { Platform } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { BiometricUnlockError } from './unlockError'
export const BIOMETRIC_PREFERENCE = 'uf_biometric_user'
const VAULT_KEY = 'uf_biometric_refresh'
const OPTIONS: SecureStore.SecureStoreOptions = { requireAuthentication: true, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, keychainService: 'ujimora.biometric-session', authenticationPrompt: 'Unlock your Ujimora account' }
export async function biometricCapability() {
  if (Platform.OS === 'web') return { available: false, label: 'Device biometrics' }
  const [hardware, enrolled, types] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(), LocalAuthentication.supportedAuthenticationTypesAsync()])
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  return { available: hardware && enrolled && SecureStore.canUseBiometricAuthentication(), label: face ? (Platform.OS === 'ios' ? 'Face ID' : 'Face or fingerprint unlock') : 'Fingerprint unlock' }
}
export async function writeBiometricCredential(userId: string, refreshToken: string, initial: boolean) {
  if (!(await biometricCapability()).available) throw new Error('Set up supported biometrics in your device settings first.')
  // Creating an iOS keychain item does not prompt. Explicitly confirm the initial opt-in.
  // Updates/reads and Android writes are authenticated by SecureStore itself.
  if (initial && Platform.OS === 'ios') {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Enable biometric unlock for Ujimora', disableDeviceFallback: true, biometricsSecurityLevel: 'strong', fallbackLabel: '' })
    if (!result.success) throw new Error('Biometric confirmation was cancelled or unsuccessful.')
  }
  await SecureStore.setItemAsync(VAULT_KEY, JSON.stringify({ userId, refreshToken }), OPTIONS)
}
export async function readBiometricCredential(): Promise<{ userId: string; refreshToken: string }> {
  if (!(await biometricCapability()).available) throw new BiometricUnlockError('Biometrics are unavailable or changed. Sign in with your password instead.')
  const value = await SecureStore.getItemAsync(VAULT_KEY, OPTIONS)
  if (!value) throw new BiometricUnlockError('Biometric access changed or expired. Sign in with your password instead.')
  const parsed = JSON.parse(value) as { userId?: unknown; refreshToken?: unknown }
  if (typeof parsed.userId !== 'string' || typeof parsed.refreshToken !== 'string') throw new BiometricUnlockError('Saved sign-in is unavailable. Sign in with your password instead.')
  return { userId: parsed.userId, refreshToken: parsed.refreshToken }
}
export async function clearBiometricCredential() {
  await SecureStore.deleteItemAsync(VAULT_KEY, OPTIONS)
  await SecureStore.deleteItemAsync(BIOMETRIC_PREFERENCE)
}
