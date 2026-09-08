import VolunteerActivismRounded from '@mui/icons-material/VolunteerActivismRounded'
import GroupsRounded from '@mui/icons-material/GroupsRounded'
import PaymentsRounded from '@mui/icons-material/PaymentsRounded'
import RedeemRounded from '@mui/icons-material/RedeemRounded'
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded'
import PaletteRounded from '@mui/icons-material/PaletteRounded'

export const featureGroups = [
  {
    id: 'creators', icon: VolunteerActivismRounded, title: 'A new way to support creators',
    description: 'Turn appreciation into support with a personal tip jar.',
    features: [
      ['Your own creator page', 'Set up a creator profile and share your public tip link with people who value your work.'],
      ['Tips and withdrawals', 'Receive tips, follow your available balance, and request withdrawals from your creator dashboard. Fees and withdrawal requirements apply.'],
    ],
    action: 'Set up your tip jar', path: '/creator',
  },
  {
    id: 'campaigns', icon: GroupsRounded, title: 'Bring your community together',
    description: 'Build your story, share the work, and keep supporters involved.',
    features: [
      ['Campaign collaboration', 'Invite collaborators to help with your campaign and manage invitations from your account.'],
      ['Updates that keep people close', 'Share campaign updates, follow donation progress, and stay connected through supporter comments.'],
      ['Live fundraising', 'Connect with supporters through campaign live streams on eligible plans, where streaming is configured.'],
      ['An organisation page of your own', 'Add a profile image and cover, present your organisation, and bring your campaigns, impact totals, and followers together.'],
    ],
    action: 'Start a campaign', path: '/my-campaigns',
  },
  {
    id: 'payments', icon: PaymentsRounded, title: 'Follow the money with clarity',
    description: 'From a contribution to a withdrawal, keep the details in view.',
    features: [
      ['Crypto contributions, where enabled', 'Review the exact crypto amount and campaign-currency value, use the supported network, and follow confirmation in checkout. See the Crypto Contribution Guide in our footer.'],
      ['More ways to contribute', 'Use your wallet or the payment methods offered for your country and currency at checkout. Available methods depend on provider configuration.'],
      ['Payout requests and review', 'Track payout status and review applicable fees and requirements. Campaign payouts follow eligibility and approval checks.'],
      ['Shared proceeds for eligible campaigns', 'Where enabled, agreed beneficiary allocations keep split proceeds, consent, and individual payout records organised. Contact us about availability.'],
    ],
    action: 'Explore your wallet', path: '/wallet',
  },
  {
    id: 'growth', icon: RedeemRounded, title: 'More room for your next chapter',
    description: 'Choose the tools that fit your work as it grows.',
    features: [
      ['Plans for individuals and organisations', 'Compare current prices, campaign limits, platform fees, and included tools. Choose monthly or yearly billing where offered.'],
      ['Coupons at checkout', 'Apply an eligible coupon when subscribing and review the updated total before paying.'],
      ['Referral rewards', 'Share your referral link and follow eligible commissions in your affiliate dashboard. Rewards and withdrawal conditions follow the current programme terms.'],
    ],
    action: 'Compare plans', path: '/pricing', marketing: true,
  },
  {
    id: 'trust', icon: VerifiedUserRounded, title: 'Trust built into the process',
    description: 'Clear review steps for people, campaigns, and payouts.',
    features: [
      ['Identity and organisation verification', 'Submit your information for review and follow your verification status. Verification provides context; it does not guarantee a campaign outcome.'],
      ['Campaign and payout safeguards', 'Campaign risk reviews, eligibility checks, and additional approvals for applicable payouts support accountable fundraising.'],
      ['Useful reporting', 'Campaign, category, geographic, and activity reports help administrators understand recorded activity. Clear empty states and paginated lists make records easier to navigate.'],
    ],
    action: 'Learn about verification', path: '/help', marketing: true,
  },
  {
    id: 'personalise', icon: PaletteRounded, title: 'Make your workspace feel like yours',
    description: 'A more personal experience, from your profile to your dashboard.',
    features: [
      ['Choose your design skin', 'Switch between neumorphism, clay, glass, and minimal styles, with light and dark appearance choices.'],
      ['Profiles that always look complete', 'Update your profile and cover images. Built-in defaults keep your page presentable when an image is missing or cannot load.'],
    ],
    action: 'Personalise your account', path: '/settings',
  },
]
