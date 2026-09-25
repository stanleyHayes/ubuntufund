import { Linking } from 'react-native'
import { Button } from './Loading'

/**
 * True when the OS will no longer show the permission prompt (the user
 * denied it permanently), so only the app's Settings page can grant it.
 */
export function permissionNeedsSettings(response: { granted: boolean; canAskAgain?: boolean }) {
  return !response.granted && response.canAskAgain === false
}

/** Opens this app's page in the device Settings app. */
export function OpenSettingsButton({ label = 'Open Settings' }: { label?: string }) {
  return <Button icon="cog-outline" onPress={() => { void Linking.openSettings().catch(() => {}) }}>{label}</Button>
}
