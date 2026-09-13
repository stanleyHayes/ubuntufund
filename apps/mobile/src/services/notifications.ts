// The package index loads DevicePushTokenAutoRegistration.fx, which can
// refresh legacy registrations on import. Keep presentation isolated from it.
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler'

// Push delivery is unavailable. Keep older callers from requesting OS access or
// collecting identifiers until consent-aware delivery and withdrawal exist.
export async function registerForPushNotificationsAsync(): Promise<null> {
  return null
}

export async function registerPushTokenWithApi(
  _token: string,
  _platform: 'ios' | 'android' | 'web'
): Promise<void> {
  throw new Error('Push notifications are not available yet.')
}

export function setupNotificationHandlers() {
  // Suppress foreground delivery to legacy installations. This cannot suppress
  // OS-rendered background pushes: legacy provider registrations need retirement.
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  })

  // Do not attach payload listeners or log private notification contents.
  return () => setNotificationHandler(null)
}
