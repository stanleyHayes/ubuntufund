import { useEffect, useState } from 'react'
import { AppState, Linking, Platform, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import Constants from 'expo-constants'
import { usePalette } from '@/context/ColorModeContext'
import { fetchReleasePolicy, updateRequirement, type UpdateRequirement } from '@/lib/appUpdate'
import { Button } from './Loading'
import { UjimoraLogo } from './UjimoraLogo'

/** Re-check on resume at most this often. */
const RECHECK_MS = 5 * 60_000

/**
 * Blocks the app with an "Update required" screen when the server's minimum
 * supported version for this platform is above this build's version. Checked
 * at launch and when the app returns to the foreground. Network errors and a
 * missing minimum leave the app usable.
 */
export function UpdateRequiredGate({ version = Constants.expoConfig?.version }: { version?: string | null }) {
  const p = usePalette()
  const [requirement, setRequirement] = useState<UpdateRequirement | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let lastCheck = 0
    const check = () => {
      if (Date.now() - lastCheck < RECHECK_MS) return
      lastCheck = Date.now()
      fetchReleasePolicy()
        .then(policy => { if (active) setRequirement(updateRequirement(policy, Platform.OS, version)) })
        .catch(() => { lastCheck = 0 })
    }
    check()
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') check() })
    return () => { active = false; subscription.remove() }
  }, [version])
  if (!requirement) return null
  const store = Platform.OS === 'ios' ? 'the App Store' : 'Google Play'
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: p.background, justifyContent: 'center', padding: 28, gap: 20, zIndex: 1000, elevation: 1000 }]} accessibilityViewIsModal>
    <UjimoraLogo size={44} />
    <Text variant="headlineMedium" accessibilityRole="header">Update required</Text>
    <Text>This version of Ujimora ({version}) is no longer supported. Update to version {requirement.minimum} or later from {store} to keep using your account, donations and campaigns.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}
    <Button mode="contained" icon="download" onPress={() => { setError(''); void Linking.openURL(requirement.storeUrl).catch(() => setError(`Could not open ${store}. Search for Ujimora there to update.`)) }}>Update Ujimora</Button>
  </View>
}
