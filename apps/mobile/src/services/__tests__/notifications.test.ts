import { describe, expect, it, vi } from 'vitest'

vi.unmock('@/services/notifications')
const sdk = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  addNotificationReceivedListener: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
}))
vi.mock('expo-notifications', () => { throw new Error('Push registration entrypoint must not load') })
vi.mock('expo-notifications/build/NotificationsHandler', () => ({ setNotificationHandler: sdk.setNotificationHandler }))
import { registerForPushNotificationsAsync, registerPushTokenWithApi, setupNotificationHandlers } from '../notifications'

describe('unavailable native push', () => {
  it('does not request permission or collect a token', async () => {
    expect(await registerForPushNotificationsAsync()).toBeNull()
    expect(sdk.getPermissionsAsync).not.toHaveBeenCalled()
    expect(sdk.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(sdk.getExpoPushTokenAsync).not.toHaveBeenCalled()
    await expect(registerPushTokenWithApi('legacy-token', 'android')).rejects.toThrow('not available')
  })

  it('suppresses every foreground presentation and installs no payload listeners', async () => {
    const cleanup = setupNotificationHandlers()
    const handler = sdk.setNotificationHandler.mock.calls.at(-1)![0]
    expect(await handler.handleNotification()).toEqual({
      shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false,
      shouldShowBanner: false, shouldShowList: false,
    })
    expect(sdk.addNotificationReceivedListener).not.toHaveBeenCalled()
    expect(sdk.addNotificationResponseReceivedListener).not.toHaveBeenCalled()
    cleanup()
    expect(sdk.setNotificationHandler).toHaveBeenLastCalledWith(null)
  })
})
