import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { api } from '@/lib/api'

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    return null
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data
  return token
}

export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await api.delete('/notifications/push/unregister', { token })
  } catch {
    // Silently fail — token may already be invalid
  }
}

export async function registerPushTokenWithApi(
  token: string,
  platform: 'ios' | 'android' | 'web'
): Promise<void> {
  await api.post('/notifications/push/register', { token, platform })
}

export function setupNotificationHandlers(
  onNotificationReceived?: (notification: Notifications.Notification) => void
) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })

  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      onNotificationReceived?.(notification)
    }
  )

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data
      // Handle navigation based on notification data
      // eslint-disable-next-line no-console
      console.log('Notification opened:', data)
    }
  )

  return () => {
    receivedSubscription.remove()
    responseSubscription.remove()
  }
}

export async function getPushNotificationSettings(): Promise<{
  donations: boolean
  comments: boolean
  milestones: boolean
  campaigns: boolean
} | null> {
  try {
    const data = await api.get<{
      pushNotificationPreferences?: {
        donations: boolean
        comments: boolean
        milestones: boolean
        campaigns: boolean
      }
    }>('/profile')
    return data.pushNotificationPreferences ?? {
      donations: true,
      comments: true,
      milestones: true,
      campaigns: true,
    }
  } catch {
    return null
  }
}

export async function updatePushNotificationPreferences(
  preferences: {
    donations?: boolean
    comments?: boolean
    milestones?: boolean
    campaigns?: boolean
  }
): Promise<void> {
  await api.put('/profile', { pushNotificationPreferences: preferences })
}
