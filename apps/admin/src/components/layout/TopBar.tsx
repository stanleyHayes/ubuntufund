import { NotificationBell } from '@ubuntu-fund/ui'
import { AdminActionInbox, useAdminActions } from '@/context/AdminActionContext'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  InputBase,
  Box,
  Typography,
  Divider,
  Link,
  ListItemIcon,
} from '@mui/material'
import { alpha, styled } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import MapRoundedIcon from '@mui/icons-material/MapRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded'
import { DRAWER_WIDTH } from './Sidebar'
import { useAuth } from '@/context/AuthContext'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { api } from '@/lib/api'
import { HAIRLINE, WASH, ON_FILL } from '@/lib/tones'

const UTILITY_BAR_HEIGHT = 34
const MAIN_BAR_HEIGHT = 64
export const TOPBAR_HEIGHT = UTILITY_BAR_HEIGHT + MAIN_BAR_HEIGHT

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 'var(--shape-input, 6px)',
  backgroundColor: alpha(theme.palette.common.white, 0.06),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.1),
  },
  width: 320,
}))

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
}))

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    fontSize: '0.875rem',
  },
}))

export default function TopBar({
  onReplayTour,
  onOpenNav,
}: {
  onReplayTour: () => void
  onOpenNav?: () => void
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const { total } = useAdminActions()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { roleName } = useAdminPermissions()

  const initials = (user?.name ?? 'Admin')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const firstName = (user?.name ?? 'Admin').split(' ')[0]

  const closeMenu = () => setAnchorEl(null)

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
        ml: { xs: 0, md: `${DRAWER_WIDTH}px` },
        bgcolor: 'transparent',
      }}
    >
      {/* Utility strip — darker, with a 1px gold seam highlight */}
      <Box
        sx={{
          height: UTILITY_BAR_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          bgcolor: '#0A120F',
          borderBottom: `1px solid ${HAIRLINE}`,
          boxShadow: 'inset 0 2px 0 rgba(199, 162, 74, 0.5)',
        }}
      >
        <Typography
          sx={{
            display: { xs: 'none', sm: 'block' },
            fontSize: '0.6rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: 'rgba(199, 162, 74, 0.75)',
          }}
        >
          Giving Across Ghana · Admin Console
        </Typography>
        <Link
          href="https://app.ujimora.com"
          target="_blank"
          rel="noreferrer"
          underline="none"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: '0.68rem',
            fontWeight: 600,
            color: 'text.secondary',
            '&:hover': { color: '#C7A24A' },
          }}
        >
          View donor site
          <LaunchRoundedIcon sx={{ fontSize: 12 }} />
        </Link>
      </Box>

      {/* Main bar */}
      <Toolbar
        sx={{
          minHeight: `${MAIN_BAR_HEIGHT}px !important`,
          justifyContent: 'space-between',
          bgcolor: 'background.paper',
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            minWidth: 0,
            flexGrow: { xs: 1, sm: 0 },
          }}
        >
          <IconButton
            edge="start"
            color="inherit"
            aria-label="Open navigation menu"
            onClick={onOpenNav}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <Search
            data-tour="search"
            sx={{ width: { xs: '100%', sm: 320 }, flexGrow: { xs: 1, sm: 0 } }}
          >
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Search campaigns, users, donations..."
              sx={{ width: '100%' }}
            />
          </Search>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationBell api={api} attentionCount={total}>
            <AdminActionInbox />
          </NotificationBell>

          <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: HAIRLINE }} />

          <Box
            component="button"
            data-tour="user-menu"
            onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
            sx={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              height: 38,
              pl: 0.5,
              pr: 1,
              borderRadius: '999px',
              border: `1px solid ${HAIRLINE}`,
              '&:hover': { bgcolor: WASH },
              '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
            }}
          >
            <Avatar
              sx={{
                width: 30,
                height: 30,
                bgcolor: '#8FAE96',
                color: ON_FILL,
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 120 }} noWrap>
              {firstName}
            </Typography>
            <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={closeMenu}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  width: 280,
                  borderRadius: '16px',
                  border: `1px solid ${HAIRLINE}`,
                  bgcolor: 'background.paper',
                },
              },
            }}
          >
            <Box
              sx={{
                mx: 1,
                mb: 0.5,
                p: 1.25,
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                borderRadius: '12px',
                border: `1px solid ${HAIRLINE}`,
                bgcolor: WASH,
              }}
            >
              <Avatar
                sx={{ width: 36, height: 36, bgcolor: '#8FAE96', color: ON_FILL, fontWeight: 700 }}
              >
                {initials}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                  {user?.name ?? 'Administrator'}
                </Typography>
                <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                  {roleName || 'Administrator'}
                </Typography>
              </Box>
            </Box>

            <MenuItem
              onClick={() => {
                closeMenu()
                navigate('/profile')
              }}
              sx={{ alignItems: 'flex-start' }}
            >
              <ListItemIcon sx={{ mt: 0.25 }}>
                <PersonRoundedIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <Box>
                Profile
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  Your account details and avatar
                </Typography>
              </Box>
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu()
                navigate('/settings')
              }}
              sx={{ alignItems: 'flex-start' }}
            >
              <ListItemIcon sx={{ mt: 0.25 }}>
                <SettingsRoundedIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <Box>
                Settings
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  Console preferences and theme
                </Typography>
              </Box>
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu()
                onReplayTour()
              }}
            >
              <ListItemIcon>
                <MapRoundedIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <Box>
                Replay tour
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  Play the console walkthrough again
                </Typography>
              </Box>
            </MenuItem>
            <Divider sx={{ borderColor: HAIRLINE }} />
            <MenuItem
              onClick={() => {
                closeMenu()
                logout()
                navigate('/login')
              }}
              sx={{ color: '#C06B58' }}
            >
              <ListItemIcon>
                <LogoutRoundedIcon sx={{ fontSize: 18, color: '#C06B58' }} />
              </ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
