export const ACTIVITY_ALERT_CATEGORIES = ['donationsReceived', 'donationsSent', 'creatorTips', 'withdrawals', 'refunds', 'wallet', 'subscriptions'] as const
export type ActivityAlertCategory = typeof ACTIVITY_ALERT_CATEGORIES[number]
export type ActivityAlertChannel = 'inApp' | 'email'
export type ActivityAlertPreferences = Record<ActivityAlertCategory, Record<ActivityAlertChannel, boolean>>
export const ACTIVITY_ALERT_LABELS: Record<ActivityAlertCategory, string> = {
  donationsReceived: 'Donations received', donationsSent: 'Donations you make', creatorTips: 'Creator tips',
  withdrawals: 'Withdrawals and payouts', refunds: 'Refund updates', wallet: 'Wallet deposits and transfers', subscriptions: 'Subscription updates',
}
export function defaultActivityAlertPreferences(): ActivityAlertPreferences {
  return Object.fromEntries(ACTIVITY_ALERT_CATEGORIES.map(category => [category, { inApp: false, email: false }])) as ActivityAlertPreferences
}
