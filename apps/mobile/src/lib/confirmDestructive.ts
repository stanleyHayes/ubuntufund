import { Alert, Platform } from 'react-native'

export interface DestructivePrompt {
  title: string
  message: string
  confirmLabel: string
}

type AlertButton = { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }
export interface ConfirmDeps {
  platform: string
  alert: (title: string, message: string, buttons: AlertButton[], options?: { cancelable?: boolean; onDismiss?: () => void }) => void
  webConfirm: (message: string) => boolean
}

const defaultDeps = (): ConfirmDeps => ({
  platform: Platform.OS,
  alert: (title, message, buttons, options) => Alert.alert(title, message, buttons, options),
  webConfirm: (message) => (typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : false),
})

/**
 * Ask before a destructive action. Resolves true only on an explicit confirm.
 * react-native-web's Alert.alert does nothing, so Expo web uses the browser's
 * confirm dialog instead of silently skipping (or silently proceeding).
 */
export function confirmDestructive(prompt: DestructivePrompt, deps: ConfirmDeps = defaultDeps()): Promise<boolean> {
  if (deps.platform === 'web') return Promise.resolve(deps.webConfirm(`${prompt.title}\n\n${prompt.message}`))
  return new Promise((resolve) => {
    deps.alert(
      prompt.title,
      prompt.message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: prompt.confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}

export function removePayoutAccountPrompt(account: { accountName: string; last4: string }): DestructivePrompt {
  return {
    title: 'Remove saved account?',
    message: `${account.accountName} ending ${account.last4} will be removed from your saved payout accounts. Payouts you have already requested keep their original destination. To use this account again you will need to add it and verify it again.`,
    confirmLabel: 'Remove account',
  }
}
