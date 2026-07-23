import * as Linking from 'expo-linking'

export const linking = {
  prefixes: ['ubuntufund://', Linking.createURL('/')],
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
      terms: 'terms',
      privacy: 'privacy',
      '+not-found': '*',
    },
  },
}
