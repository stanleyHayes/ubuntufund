import { useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Avatar from '@mui/material/Avatar'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Drawer from '@mui/material/Drawer'
import Tooltip from '@mui/material/Tooltip'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { SHAPE, BrandLogo } from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Explore', to: '/explore' },
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
            aria-label="UbuntuFund home"
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
                color: CREAM,
                border: '1px solid rgba(245, 242, 234, 0.20)',
                '&:hover': { bgcolor: 'rgba(245, 242, 234, 0.08)', borderColor: 'rgba(245, 242, 234, 0.35)' },
              }}
            >
              <SearchRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>

          {/* Right cluster */}
          {isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                <CtaButton to="/campaigns/new">Start a Campaign</CtaButton>
              </Box>
              <Box
                component="button"
                onClick={(e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)}
                aria-label="Account menu"
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
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={closeMenu}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{
                  paper: {
                    sx: {
                      mt: 1,
                      width: 260,
                      borderRadius: '16px',
                      border: '1px solid #E7E3D8',
                      '& .MuiMenuItem-root': { py: 1, mx: 1, borderRadius: '10px' },
                      '& .MuiListItemIcon-root': { color: '#5E8F72', minWidth: 34 },
                    },
                  },
                }}
              >
                <Box
                  sx={{
                    mx: 1,
                    mb: 0.75,
                    p: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    borderRadius: '12px',
                    bgcolor: 'rgba(168, 181, 160, 0.16)',
                    border: '1px solid #E7E3D8',
                  }}
                >
                  <Avatar sx={{ width: 36, height: 36, bgcolor: '#2E3D2F', color: '#F5F2EA', fontWeight: 700, fontSize: '0.85rem' }}>
                    {initials}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                      {user?.name}
                    </Typography>
                    <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
                      {user?.email}
                    </Typography>
                  </Box>
                </Box>
                <MenuItem onClick={() => { closeMenu(); navigate('/dashboard') }}>
                  <ListItemIcon><DashboardRoundedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                  Dashboard
                </MenuItem>
                <MenuItem onClick={() => { closeMenu(); navigate('/my-campaigns') }}>
                  <ListItemIcon><RocketLaunchRoundedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                  My Campaigns
                </MenuItem>
                <MenuItem onClick={() => { closeMenu(); navigate('/donations') }}>
                  <ListItemIcon><VolunteerActivismRoundedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                  My Donations
                </MenuItem>
                <MenuItem onClick={() => { closeMenu(); navigate('/wallet') }}>
                  <ListItemIcon><AccountBalanceWalletRoundedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                  Wallet
                </MenuItem>
                <MenuItem onClick={() => { closeMenu(); navigate('/settings') }}>
                  <ListItemIcon><SettingsRoundedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                  Settings
                </MenuItem>
                <Divider />
                <MenuItem
                  onClick={() => { closeMenu(); logout(); navigate('/') }}
                  sx={{ color: '#A5432F', '&:hover': { bgcolor: 'rgba(165, 67, 47, 0.08)' } }}
                >
                  <ListItemIcon><LogoutRoundedIcon sx={{ fontSize: 18, color: '#A5432F' }} /></ListItemIcon>
                  Sign out
                </MenuItem>
              </Menu>
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
        slotProps={{ paper: { sx: { width: '86vw', maxWidth: 360, bgcolor: '#1C261D', color: CREAM, p: 2 } } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <BrandLogo size={26} onDark />
          <IconButton aria-label="Close menu" onClick={() => setDrawerOpen(false)} sx={{ color: CREAM }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>
        {[...NAV_LINKS, ...(isAuthenticated
          ? [
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Start a Campaign', to: '/campaigns/new' },
              { label: 'Wallet', to: '/wallet' },
            ]
          : [
              { label: 'Login', to: '/login' },
              { label: 'Get Started', to: '/register' },
            ])].map((link) => (
          <Button
            key={link.to}
            component={RouterLink}
            to={link.to}
            onClick={() => setDrawerOpen(false)}
            fullWidth
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontSize: '0.82rem',
              color: isLinkActive(pathname, link.to) ? GOLD_LIGHT : CREAM,
              fontWeight: 600,
              py: 1.1,
              borderRadius: SHAPE.sm,
              bgcolor: isLinkActive(pathname, link.to) ? 'rgba(245, 242, 234, 0.08)' : 'transparent',
              '&:hover': { bgcolor: 'rgba(245, 242, 234, 0.08)' },
            }}
          >
            {link.label}
          </Button>
        ))}
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
