import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'

const destinations = [
  {
    title: 'Dashboard',
    description: 'Your activity, at a glance.',
    to: '/dashboard',
    icon: DashboardRoundedIcon,
  },
  {
    title: 'Profile',
    description: 'Your details and password.',
    to: '/profile',
    icon: PersonRoundedIcon,
  },
  {
    title: 'My Campaigns',
    description: 'Manage the causes you lead.',
    to: '/my-campaigns',
    icon: RocketLaunchRoundedIcon,
  },
  {
    title: 'My Donations',
    description: 'Revisit the causes you support.',
    to: '/donations',
    icon: VolunteerActivismRoundedIcon,
  },
  {
    title: 'Wallet',
    description: 'Balances and transactions.',
    to: '/wallet',
    icon: AccountBalanceWalletRoundedIcon,
  },
  {
    title: 'Affiliate',
    description: 'Referrals and commissions.',
    to: '/affiliate',
    icon: HandshakeRoundedIcon,
  },
  {
    title: 'Creator page',
    description: 'Your tip jar and balance.',
    to: '/creator',
    icon: StorefrontRoundedIcon,
  },
  {
    title: 'Subscription',
    description: 'Your plan and billing.',
    to: '/subscription',
    icon: WorkspacePremiumRoundedIcon,
  },
  {
    title: 'Payout accounts',
    description: 'Bank and mobile-money accounts.',
    to: '/payout-accounts',
    icon: AccountBalanceWalletRoundedIcon,
  },
  {
    title: 'Settings',
    description: 'Make your account yours.',
    to: '/settings',
    icon: SettingsRoundedIcon,
  },
]

interface AccountMenuProps {
  anchor: HTMLElement | null
  onClose: () => void
  onSignOut: () => void
  name?: string
  email?: string
  avatarUrl?: string
  initials: string
}

export default function AccountMenu({
  anchor,
  onClose,
  onSignOut,
  name,
  email,
  initials,
  avatarUrl,
}: AccountMenuProps) {
  const { pathname } = useLocation()
  return (
    <Popover
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={onClose}
      marginThreshold={12}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      slotProps={{
        paper: {
          id: 'account-panel',
          role: 'dialog',
          'aria-labelledby': 'account-panel-title',
          sx: {
            mt: 1.5,
            width: 420,
            maxWidth: 'calc(100vw - 24px)',
            p: 1.5,
            bgcolor: 'var(--neu-surface)',
            backgroundImage: 'none',
            color: 'text.primary',
            borderRadius: SHAPE.card,
            border: 'var(--neu-border)',
            boxShadow: 'var(--neu-raised)',
            backdropFilter: 'var(--neu-backdrop)',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          mb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Avatar
          src={avatarUrl}
          sx={{ width: 46, height: 46, bgcolor: 'primary.main', color: 'primary.contrastText' }}
        >
          {initials}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id="account-panel-title" sx={{ fontWeight: 800 }}>
            {name || 'Your account'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {email}
          </Typography>
        </Box>
        <IconButton aria-label="Close account menu" onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box
        component="nav"
        aria-label="Your account"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
          gap: 1,
          '@media(max-width:359px)': { gridTemplateColumns: '1fr' },
        }}
      >
        {destinations.map(({ title, description, to, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`)
          return (
            <ButtonBase
              component={RouterLink}
              to={to}
              key={to}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                textAlign: 'left',
                gap: 1.25,
                p: 1.5,
                minHeight: 62,
                minWidth: 0,
                color: 'text.primary',
                borderRadius: SHAPE.sm,
                border: 'var(--neu-border)',
                bgcolor: 'var(--neu-surface)',
                boxShadow: active ? 'var(--neu-inset)' : 'var(--neu-subtle)',
                backdropFilter: 'var(--neu-backdrop)',
                '&:hover': { boxShadow: 'var(--neu-raised-hover)' },
                '&.Mui-focusVisible': {
                  outline: '2px solid',
                  outlineColor: 'secondary.main',
                  outlineOffset: 2,
                },
              }}
            >
              <Icon
                sx={{
                  fontSize: 21,
                  color: active ? 'secondary.main' : 'primary.main',
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 750, fontSize: '.82rem' }}>{title}</Typography>
                <Typography
                  sx={{ fontSize: '.68rem', color: 'text.secondary', mt: 0.25, lineHeight: 1.4 }}
                >
                  {description}
                </Typography>
              </Box>
            </ButtonBase>
          )
        })}
      </Box>
      <ButtonBase
        onClick={onSignOut}
        sx={{
          display: 'flex',
          gap: 1,
          width: '100%',
          p: 1.5,
          mt: 1.5,
          borderRadius: SHAPE.sm,
          color: 'error.main',
          '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'error.main' },
        }}
      >
        <LogoutRoundedIcon fontSize="small" />
        <Typography sx={{ fontWeight: 700, fontSize: '.85rem' }}>Sign out</Typography>
      </ButtonBase>
    </Popover>
  )
}
