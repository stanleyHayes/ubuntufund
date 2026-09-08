import AccountMenu from './AccountMenu'
import { useState } from 'react'
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
import { SHAPE, BrandLogo } from '@ubuntu-fund/ui'
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
        borderRadius: '999px',
        px: 2.5,
        py: 0.85,
        fontFamily: '"Outfit", sans-serif',
        fontWeight: 700,
        fontSize: '0.78rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: GOLD_LIGHT,
        border: `1.5px solid rgba(199, 162, 74, 0.55)`,
        bgcolor: 'transparent',
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
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const initials = (user?.name ?? 'U')
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
                  borderRadius: '999px',
                  border: '1px solid rgba(245, 242, 234, 0.22)',
                  '&:hover': { bgcolor: 'rgba(245, 242, 234, 0.08)' },
                  '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
                }}
              >
                <Avatar sx={{ width: 30, height: 30, bgcolor: '#A8B5A0', color: '#1C261D', fontSize: '0.75rem', fontWeight: 700 }}>
                  {initials}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' }, maxWidth: 110 }} noWrap>
                  {(user?.name ?? '').split(' ')[0]}
                </Typography>
                <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'rgba(245, 242, 234, 0.6)' }} />
              </Box>
              <AccountMenu anchor={menuAnchor} onClose={closeMenu} name={user?.name} email={user?.email} initials={initials}
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
              width: '88vw',
              maxWidth: 390,
              bgcolor: '#1C261D',
              color: CREAM,
              p: 2.5,
              '--neu-surface': '#1C261D',
              '--neu-subtle': 'var(--forest-subtle)',
              '--neu-raised-hover': 'var(--forest-raised-hover)',
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
              bgcolor: '#1C261D !important',
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
                { label: 'Settings', to: '/settings', icon: <SettingsRoundedIcon /> },
              ]
            : [
                { label: 'Login', to: '/login', icon: <LoginRoundedIcon /> },
                { label: 'Get Started', to: '/register', icon: <PersonAddAltRoundedIcon /> },
              ]),
        ].map((link) => {
          const active = isLinkActive(pathname, link.to)
          return (
          <Button
            key={link.to}
            component={RouterLink}
            to={link.to}
            onClick={() => setDrawerOpen(false)}
            fullWidth
            sx={{
              minWidth: 0,
              minHeight: 112,
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
              bgcolor: '#1C261D',
              boxShadow: active ? 'var(--forest-inset)' : 'var(--forest-raised)',
              '&:hover': { bgcolor: '#1C261D', boxShadow: 'var(--forest-raised)', transform: 'translateY(-2px)' },
              '& .MuiSvgIcon-root': { fontSize: 25 },
            }}
          >
            <Box sx={{ color: active ? GOLD_LIGHT : 'rgba(220,192,126,.72)', lineHeight: 0 }}>{link.icon}</Box>
            <Typography sx={{ fontSize: '.86rem', fontWeight: 750, color: 'inherit' }}>{link.label}</Typography>
          </Button>
          )
        })}
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
