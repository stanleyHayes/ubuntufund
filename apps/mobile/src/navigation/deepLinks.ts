import { LEGAL_POLICIES } from '@ubuntu-fund/types/src/legal'
import * as Linking from 'expo-linking'

export const linking = {
  prefixes: ['ujimora://', Linking.createURL('/')],
  config: {
    screens: {
      '(tabs)': {
        screens: {
          explore: 'campaigns',
          index: '',
        },
      },
      'campaign/[id]': 'campaigns/:id',
      'campaign/create': 'campaigns/new',
      dashboard: 'dashboard',
      'my-campaigns': 'my-campaigns',
      'my-donations': 'my-donations',
      profile: 'profile/:id',
      settings: 'settings',
      leaderboard: 'leaderboard',
      organizations: 'organizations',
      invitations: 'invitations',
      'refund-request': 'refund-request',
      'my-refunds': 'my-refunds',
      legal: 'legal',
      ...Object.fromEntries(LEGAL_POLICIES.map(policy => [policy.slug, policy.slug])),
      terms: 'terms',
      privacy: 'privacy',
      '+not-found': '*',
    },
  },
}
