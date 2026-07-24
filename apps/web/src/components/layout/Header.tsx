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
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
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

function isLinkActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
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
        bgcolor: 'background.paper',
        borderBottom: '1px solid #E7E3D8',
        color: 'text.primary',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2, minHeight: { xs: 60, md: 68 } }}>
          {/* Brand */}
          <Box
            component={RouterLink}
            to="/"
            aria-label="UbuntuFund home"
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', mr: 2 }}
          >
            <BrandLogo size={34} />
          </Box>

          {/* Desktop nav */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, flex: 1 }}>
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(pathname, link.to)
              return (
                <Button
                  key={link.to}
                  component={RouterLink}
                  to={link.to}
                  sx={{
                    px: 1.75,
                    borderRadius: SHAPE.sm,
                    fontSize: '0.875rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#2E3D2F' : 'text.secondary',
                    bgcolor: active ? 'rgba(168, 181, 160, 0.28)' : 'transparent',
                    '&:hover': { bgcolor: active ? 'rgba(168, 181, 160, 0.28)' : 'rgba(46, 61, 47, 0.05)' },
                  }}
                >
                  {link.label}
                </Button>
              )
            })}
          </Box>
          <Box sx={{ flex: { xs: 1, md: 0 } }} />

          {/* Right cluster */}
          {isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Button
                component={RouterLink}
                to="/campaigns/new"
                variant="contained"
                color="secondary"
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, borderRadius: '999px', px: 2.25, fontWeight: 700 }}
              >
                Start a Campaign
              </Button>
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
                  border: '1px solid #E7E3D8',
                  '&:hover': { bgcolor: 'rgba(46, 61, 47, 0.04)' },
                  '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
                }}
              >
                <Avatar sx={{ width: 30, height: 30, bgcolor: '#2E3D2F', color: '#F5F2EA', fontSize: '0.75rem', fontWeight: 700 }}>
                  {initials}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' }, maxWidth: 110 }} noWrap>
                  {(user?.name ?? '').split(' ')[0]}
                </Typography>
                <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Box>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={closeMenu}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{ paper: { sx: { mt: 1, width: 230, borderRadius: '14px', border: '1px solid #E7E3D8' } } }}
              >
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
                <MenuItem onClick={() => { closeMenu(); logout(); navigate('/') }} sx={{ color: '#A5432F' }}>
                  <ListItemIcon><LogoutRoundedIcon sx={{ fontSize: 18, color: '#A5432F' }} /></ListItemIcon>
                  Sign out
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
              <Button component={RouterLink} to="/login" sx={{ color: 'text.primary', fontWeight: 600 }}>
                Login
              </Button>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                color="primary"
                sx={{ borderRadius: '999px', px: 2.5, fontWeight: 700 }}
              >
                Get Started
              </Button>
            </Box>
          )}

          {/* Mobile hamburger */}
          <IconButton
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, color: '#2E3D2F' }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Toolbar>
      </Container>

      {/* Mobile drawer — forest panel, per the house drawer pattern */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: '86vw', maxWidth: 360, bgcolor: '#1C261D', color: '#F5F2EA', p: 2 } } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 700 }}>UbuntuFund</Typography>
          <IconButton aria-label="Close menu" onClick={() => setDrawerOpen(false)} sx={{ color: '#F5F2EA' }}>
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
              color: isLinkActive(pathname, link.to) ? '#C7A24A' : '#F5F2EA',
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
