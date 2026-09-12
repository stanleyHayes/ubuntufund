import { api } from '@/lib/api'
import AccountMenu from './AccountMenu'
import { Fragment, useState, useEffect } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Avatar from '@mui/material/Avatar'
import IconButton from '@mui/material/IconButton'
import Drawer from '@mui/material/Drawer'
import Tooltip from '@mui/material/Tooltip'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { SHAPE, BrandLogo, getSkinVars, NotificationBell } from '@ubuntu-fund/ui'
import { useColorMode } from '@/context/ColorModeContext'
import { useAuth } from '@/context/AuthContext'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Campaigns', to: '/explore' },
  { label: 'Organizations', to: '/organizations' },
  { label: 'Leaderboard', to: '/leaderboard' },
]

const CREAM = '#F5F2EA'
const GOLD = '#C7A24A'
const GOLD_LIGHT = '#DCC07E'

function isLinkActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

/** Uppercase nav item with a gold active-underline (design language #2). */
function NavItem({ label, to, active }: { label: string; to: string; active: boolean }) {
  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        height: 40,
        px: 1.5,
        textDecoration: 'none',
        '&:hover .nav-label': { color: CREAM },
      }}
    >
      <Typography
        className="nav-label"
        sx={{
          fontFamily: '"Outfit", sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          fontSize: '0.78rem',
          fontWeight: active ? 700 : 600,
          color: active ? CREAM : 'rgba(245, 242, 234, 0.72)',
          transition: 'color 160ms ease',
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          position: 'absolute',
          bottom: 4,
          left: 12,
          right: 12,
          height: 2,
          borderRadius: 2,
          bgcolor: GOLD,
          transformOrigin: 'center',
          transform: active ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 180ms ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      />
    </Box>
  )
}

/** Outlined gold pill CTA with a trailing arrow; fills gold on hover. */
function CtaButton({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Button
      component={RouterLink}
      to={to}
      endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
      sx={{
        borderRadius: SHAPE.sm,
        px: 2.5,
        py: 0.85,
        fontFamily: '"Outfit", sans-serif',
        fontWeight: 700,
        fontSize: '0.78rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: GOLD_LIGHT,
        border: `1.5px solid rgba(199, 162, 74, 0.55)`,
        bgcolor: 'var(--neu-surface)',
        boxShadow: 'var(--neu-raised)',
        backdropFilter: 'var(--neu-backdrop)',
        transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease',
        '&:hover': { bgcolor: GOLD, color: '#1C261D', borderColor: GOLD },
      }}
    >
      {children}
    </Button>
  )
}

export function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const [organizationName, setOrganizationName] = useState(user?.organizationName ?? '')
  const [avatarUrl, setAvatarUrl] = useState('')
  useEffect(() => { if (!user?.id) return; let active = true; api.get<{avatarUrl?:string; organizationName?:string}>('/profile').then(p => { if(active) { setAvatarUrl(p.avatarUrl || ''); setOrganizationName(p.organizationName || '') } }).catch(() => {}); return () => {active=false} }, [user?.id, pathname])
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const { skin } = useColorMode()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const initials = (organizationName || user?.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const closeMenu = () => setMenuAnchor(null)

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        ...getSkinVars(skin, true),
        bgcolor: '#1C261D',
        // Square the bar: it's a full-width MuiPaper, and the theme rounds every
        // Paper (SHAPE.card), which left rounded corners exposing the page behind.
        borderRadius: 0,
        '--neu-surface': '#1C261D',
        '--neu-raised': 'var(--forest-raised)',
        '--neu-raised-hover': 'var(--forest-raised-hover)',
        '--neu-subtle': 'var(--forest-subtle)',
        '--neu-inset': 'var(--forest-inset)',
        color: CREAM,
        boxShadow: 'inset 0 -2px 0 rgba(199, 162, 74, 0.45)',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2, minHeight: { xs: 62, md: 74 } }}>
          {/* Brand + tagline */}
          <Box
            component={RouterLink}
            to="/"
            aria-label="Ujimora home"
            sx={{ display: 'flex', flexDirection: 'column', textDecoration: 'none', mr: 3, py: 0.5 }}
          >
            <BrandLogo size={28} onDark />
            <Typography
              sx={{
                mt: 0.35,
                fontFamily: '"Outfit", sans-serif',
                fontSize: '0.56rem',
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(245, 242, 234, 0.5)',
                pl: '38px',
              }}
            >
              One chain · Many hands
            </Typography>
          </Box>

          {/* Desktop nav — uppercase with gold active underline */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5, flex: 1 }}>
            {NAV_LINKS.map((link) => (
              <NavItem key={link.to} label={link.label} to={link.to} active={isLinkActive(pathname, link.to)} />
            ))}
          </Box>
          <Box sx={{ flex: { xs: 1, md: 0 } }} />

          {/* Search */}
          <Tooltip title="Search campaigns">
            <IconButton
              aria-label="Search campaigns"
              onClick={() => navigate('/explore')}
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
                width: 40,
                height: 40,
                color: GOLD_LIGHT,
                bgcolor: 'var(--neu-surface)',
                boxShadow: 'var(--neu-subtle) !important',
                '&:hover': { bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised-hover) !important', transform: 'translateY(-1px)' },
              }}
            >
              <SearchRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>

          {/* Right cluster */}
          {isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <NotificationBell api={api} iconColor={GOLD_LIGHT} />
              <Box sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
                <CtaButton to="/campaigns/new">Start a Campaign</CtaButton>
              </Box>
              <Box
                component="button"
                onClick={(e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)}
                aria-label="Account menu"
                aria-haspopup="dialog"
                aria-expanded={Boolean(menuAnchor)}
                aria-controls={menuAnchor ? 'account-panel' : undefined}
                sx={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  height: 40,
                  pl: 0.5,
                  pr: 1,
                  borderRadius: SHAPE.sm,
                  border: 'var(--neu-border)',
                  bgcolor: 'var(--neu-surface)',
                  boxShadow: 'var(--neu-subtle)',
                  backdropFilter: 'var(--neu-backdrop)',
                  '&:hover': { bgcolor: 'rgba(245, 242, 234, 0.08)' },
                  '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
                }}
              >
                <Avatar src={avatarUrl} sx={{ width: 30, height: 30, bgcolor: '#A8B5A0', color: '#1C261D', fontSize: '0.75rem', fontWeight: 700 }}>
                  {initials}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' }, maxWidth: 110 }} noWrap>
                  {organizationName || (user?.name ?? '').split(' ')[0]}
                </Typography>
                <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'rgba(245, 242, 234, 0.6)' }} />
              </Box>
              <AccountMenu anchor={menuAnchor} onClose={closeMenu} name={organizationName || user?.name} email={user?.email} initials={initials} avatarUrl={avatarUrl}
                onSignOut={() => { closeMenu(); logout(); navigate('/') }} />
            </Box>
          ) : (
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.5 }}>
              <Button
                component={RouterLink}
                to="/login"
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: '0.78rem',
                  color: 'rgba(245, 242, 234, 0.85)',
                  fontWeight: 600,
                  '&:hover': { color: CREAM, bgcolor: 'rgba(245, 242, 234, 0.08)' },
                }}
              >
                Login
              </Button>
              <CtaButton to="/register">Get Started</CtaButton>
            </Box>
          )}

          {/* Mobile hamburger */}
          <IconButton
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, color: CREAM }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Toolbar>
      </Container>

      {/* Mobile drawer — forest panel */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              ...getSkinVars(skin, true),
              width: '92vw',
              maxWidth: 420,
              bgcolor: 'var(--neu-surface)',
              backgroundImage: 'radial-gradient(ellipse at top right, rgba(199,162,74,.1), transparent 55%)',
              border: 'var(--neu-border)',
              backdropFilter: 'var(--neu-backdrop)',
              color: CREAM,
              height: '100dvh',
              boxSizing: 'border-box',
              overflowY: 'auto',
              p: 2.5,
              pb: 'calc(20px + env(safe-area-inset-bottom, 0px))',
              // Keep the footer and navigation at their natural height on short screens.
              // The drawer scrolls instead of shrinking and clipping its flex children.
              '& > *': { flexShrink: 0 },
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <BrandLogo size={26} onDark />
          <IconButton
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            sx={{
              width: 42,
              height: 42,
              color: GOLD_LIGHT,
              bgcolor: 'var(--neu-surface) !important',
              boxShadow: 'var(--forest-raised) !important',
              '&:hover': { bgcolor: '#1C261D', transform: 'translateY(-1px)' },
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
        {[
          { label: 'Home', to: '/', icon: <HomeRoundedIcon /> },
          { label: 'Campaigns', to: '/explore', icon: <ExploreRoundedIcon /> },
          { label: 'Organizations', to: '/organizations', icon: <BusinessRoundedIcon /> },
          { label: 'Leaderboard', to: '/leaderboard', icon: <EmojiEventsRoundedIcon /> },
          ...(isAuthenticated
            ? [
                { label: 'Dashboard', to: '/dashboard', icon: <DashboardRoundedIcon /> },
                { label: 'Profile', to: '/profile', icon: <PersonRoundedIcon /> },
                { label: 'Start Campaign', to: '/campaigns/new', icon: <RocketLaunchRoundedIcon /> },
                { label: 'Wallet', to: '/wallet', icon: <AccountBalanceWalletRoundedIcon /> },
                { label: 'Affiliate', to: '/affiliate', icon: <HandshakeRoundedIcon /> },
                { label: 'Creator page', to: '/creator', icon: <StorefrontRoundedIcon /> },
                { label: 'Subscription', to: '/subscription', icon: <WorkspacePremiumRoundedIcon /> },
                { label: 'Payout accounts', to: '/payout-accounts', icon: <AccountBalanceWalletRoundedIcon /> },
                { label: 'Settings', to: '/settings', icon: <SettingsRoundedIcon /> },
              ]
            : [
                { label: 'Login', to: '/login', icon: <LoginRoundedIcon /> },
                { label: 'Get Started', to: '/register', icon: <PersonAddAltRoundedIcon /> },
              ]),
        ].map((link, index) => {
          const active = isLinkActive(pathname, link.to)
          return (
          <Fragment key={link.to}>
          {(index === 0 || index === 4) && <Typography sx={{ gridColumn: '1 / -1', mt: index === 4 ? 2 : 0, mb: .5, color: GOLD_LIGHT, fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase' }}>{index === 0 ? 'Explore Ujimora' : isAuthenticated ? 'Your workspace' : 'Join the community'}</Typography>}
          <Button
            aria-current={active ? 'page' : undefined}
            component={RouterLink}
            to={link.to}
            onClick={() => setDrawerOpen(false)}
            fullWidth
            sx={{
              minWidth: 0,
              minHeight: 98,
              position: 'relative',
              overflow: 'hidden',
              isolation: 'isolate',
              p: 2,
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexDirection: 'column',
              textAlign: 'left',
              textTransform: 'none',
              color: active ? GOLD_LIGHT : CREAM,
              fontWeight: 700,
              lineHeight: 1.15,
              borderRadius: SHAPE.card,
              bgcolor: 'var(--neu-surface)',
              border: 'var(--neu-border)',
              backdropFilter: 'var(--neu-backdrop)',
              boxShadow: active ? 'var(--forest-inset)' : 'var(--forest-raised)',
              '&:hover': { bgcolor: '#1C261D', boxShadow: 'var(--forest-raised)', transform: 'translateY(-2px)' },
              '& > .menu-icon .MuiSvgIcon-root': { fontSize: 22 },
              '&.Mui-focusVisible': { outline: '2px solid #DCC07E', outlineOffset: 3 },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
            }}
          >
            <Box aria-hidden="true" sx={{ position: 'absolute', right: -10, bottom: -14, transform: 'rotate(-14deg)', color: GOLD_LIGHT, opacity: .09, pointerEvents: 'none', zIndex: -1, '& .MuiSvgIcon-root': { fontSize: 100 } }}>{link.icon}</Box>
            <Box className="menu-icon" sx={{ color: active ? GOLD_LIGHT : 'rgba(220,192,126,.72)', lineHeight: 0 }}>{link.icon}</Box>
            <Typography sx={{ fontSize: '.86rem', fontWeight: 750, color: 'inherit' }}>{link.label}</Typography>
          </Button>
          </Fragment>
          )
        })}
        </Box>
        <Box sx={{ position: 'relative', overflow: 'hidden', mt: 3, pt: 2.5, pb: 1, borderTop: '1px solid rgba(220,192,126,.18)' }}>
          <Box component="svg" aria-hidden="true" viewBox="0 0 180 80" sx={{ width: 150, height: 70, position: 'absolute', right: -12, top: -2, color: GOLD_LIGHT, opacity: .12, pointerEvents: 'none' }}><rect x="22" y="18" width="43" height="43" rx="6" transform="rotate(45 43 40)" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="88" cy="40" r="27" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M117 40h42m-10-10 10 10-10 10" fill="none" stroke="currentColor" strokeWidth="2" /></Box>
          <Typography sx={{ fontWeight: 700, fontSize: '.9rem', color: CREAM }}>One chain. Many hands.</Typography>
          <Typography sx={{ fontSize: '.75rem', color: 'rgba(245,242,234,.65)', mt: .5 }}>Make a difference, together.</Typography>
        </Box>
        {isAuthenticated && (
          <Button
            onClick={() => { setDrawerOpen(false); logout(); navigate('/') }}
            fullWidth
            sx={{ justifyContent: 'flex-start', color: '#C06B58', fontWeight: 600, py: 1.1, mt: 1 }}
          >
            Sign out
          </Button>
        )}
      </Drawer>
    </AppBar>
  )
}
