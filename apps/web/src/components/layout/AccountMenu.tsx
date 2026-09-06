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
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'

const destinations = [
  { title: 'Dashboard', description: 'Your activity, at a glance.', to: '/dashboard', icon: DashboardRoundedIcon },
  { title: 'My Campaigns', description: 'Manage the causes you lead.', to: '/my-campaigns', icon: RocketLaunchRoundedIcon },
  { title: 'My Donations', description: 'Revisit the causes you support.', to: '/donations', icon: VolunteerActivismRoundedIcon },
  { title: 'Wallet', description: 'Balances and transactions.', to: '/wallet', icon: AccountBalanceWalletRoundedIcon },
  { title: 'Affiliate', description: 'Referrals and commissions.', to: '/affiliate', icon: HandshakeRoundedIcon },
  { title: 'Settings', description: 'Make your account yours.', to: '/settings', icon: SettingsRoundedIcon },
]

interface AccountMenuProps {
  anchor: HTMLElement | null
  onClose: () => void
  onSignOut: () => void
  name?: string
  email?: string
  initials: string
}

export default function AccountMenu({ anchor, onClose, onSignOut, name, email, initials }: AccountMenuProps) {
  const { pathname } = useLocation()
  return <Popover anchorEl={anchor} open={Boolean(anchor)} onClose={onClose} marginThreshold={12}
    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} transformOrigin={{ horizontal: 'right', vertical: 'top' }}
    slotProps={{ paper: { id: 'account-panel', role: 'dialog', 'aria-labelledby': 'account-panel-title', sx: {
      mt: 1, width: 450, maxWidth: 'calc(100vw - 24px)', p: 1.5, boxSizing: 'border-box',
      bgcolor: 'background.paper', backgroundImage: 'none', color: 'text.primary',
      borderRadius: SHAPE.card, border: '1px solid', borderColor: 'divider', boxShadow: 'var(--neu-raised)',
    } } }}>
    <Box sx={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 1.5,
      p: 2, pr: 5, mb: 2, borderRadius: SHAPE.sm, bgcolor: '#2E3D2F', color: '#F5F2EA' }}>
      <Box component="svg" viewBox="0 0 160 100" aria-hidden="true" sx={{ position: 'absolute', right: -24, bottom: -20, width: 180, fill: 'none', stroke: '#DCC07E', strokeWidth: 1.5, opacity: .15, pointerEvents: 'none' }}>
        <rect x="45" y="8" width="62" height="62" rx="10" transform="rotate(35 76 39)" /><circle cx="113" cy="62" r="33" /><circle cx="113" cy="62" r="24" />
      </Box>
      <Avatar sx={{ width: 44, height: 44, bgcolor: '#DCC07E', color: '#1C261D', fontSize: '.95rem', fontWeight: 800 }}>{initials}</Avatar>
      <Box sx={{ position: 'relative', minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '.14em', color: '#DCC07E', mb: .25, fontWeight: 700 }}>Your account</Typography>
        <Typography id="account-panel-title" sx={{ fontSize: '1rem', lineHeight: 1.3, fontWeight: 800, overflowWrap: 'anywhere' }}>{name || 'Your account'}</Typography>
        <Typography sx={{ fontSize: '.75rem', color: '#D4DED5', mt: .5, overflowWrap: 'anywhere' }}>{email}</Typography>
      </Box>
      <IconButton aria-label="Close account menu" size="small" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8, color: '#F5F2EA', bgcolor: 'transparent', boxShadow: 'none !important', '&:hover': { bgcolor: 'rgba(255,255,255,.1)' } }}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
    </Box>
    <Box component="nav" aria-label="Your account" sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25,
      '@media (max-width: 359px)': { gridTemplateColumns: '1fr' } }}>
      {destinations.map(({ title, description, to, icon: Icon }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`)
        return <ButtonBase component={RouterLink} to={to} onClick={onClose} key={to} aria-current={active ? 'page' : undefined}
          sx={{ position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: 132, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            textAlign: 'left', p: 1.75, color: 'text.primary', bgcolor: active ? 'action.selected' : 'background.paper',
            borderRadius: SHAPE.sm, border: '1px solid', borderColor: active ? 'secondary.main' : 'divider',
            transition: 'background-color 160ms ease, border-color 160ms ease',
            '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main', '& .account-arrow': { opacity: 1 } },
            '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}>
          <Icon aria-hidden="true" sx={{ position: 'absolute', fontSize: 94, right: -20, top: -12, color: 'primary.main', opacity: .075, transform: 'rotate(-15deg)', pointerEvents: 'none' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mb: 1.5, position: 'relative' }}>
            <Icon sx={{ fontSize: 23, color: 'primary.main' }} />
            <ArrowOutwardRoundedIcon className="account-arrow" sx={{ fontSize: 15, color: 'text.secondary', opacity: active ? 1 : .4 }} />
          </Box>
          <Typography component="span" sx={{ position: 'relative', fontWeight: 750, fontSize: '.9rem', lineHeight: 1.35, mb: .5 }}>{title}</Typography>
          <Typography component="span" sx={{ position: 'relative', color: 'text.secondary', fontSize: '.75rem', lineHeight: 1.5 }}>{description}</Typography>
        </ButtonBase>
      })}
    </Box>
    <ButtonBase onClick={onSignOut} sx={{ position: 'relative', overflow: 'hidden', width: '100%', display: 'flex', justifyContent: 'flex-start', gap: 1.5,
      mt: 1.5, p: 1.5, textAlign: 'left', borderRadius: SHAPE.sm, border: '1px solid', borderColor: 'divider', color: 'var(--text-error)',
      '&:hover': { bgcolor: 'action.hover' }, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'error.main', outlineOffset: 2 } }}>
      <LogoutRoundedIcon sx={{ fontSize: 22 }} />
      <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700, fontSize: '.85rem' }}>Sign out</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '.72rem' }}>End this session on this device.</Typography></Box>
      <LogoutRoundedIcon aria-hidden="true" sx={{ position: 'absolute', right: -3, fontSize: 72, opacity: .07, transform: 'rotate(-15deg)', pointerEvents: 'none' }} />
    </ButtonBase>
  </Popover>
}
