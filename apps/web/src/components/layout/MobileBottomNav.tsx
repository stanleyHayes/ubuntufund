import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import { Link as RouterLink, useLocation } from 'react-router-dom'

const tabs = [
  { label: 'Home', to: '/', icon: HomeRoundedIcon },
  { label: 'Explore', to: '/explore', icon: ExploreRoundedIcon },
  { label: 'Start', to: '/campaigns/new', icon: AddRoundedIcon },
  { label: 'Dashboard', to: '/dashboard', icon: DashboardRoundedIcon },
  { label: 'Profile', to: '/profile', icon: PersonRoundedIcon },
]

export function MobileBottomNav() {
  const { pathname } = useLocation()

  return (
    <Box
      component="nav"
      aria-label="Mobile navigation"
      sx={{
        display: { xs: 'grid', md: 'none' },
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        position: 'fixed',
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        left: 'max(12px, env(safe-area-inset-left, 0px))',
        right: 'max(12px, env(safe-area-inset-right, 0px))',
        maxWidth: 480,
        mx: 'auto',
        zIndex: (theme) => theme.zIndex.appBar,
        bgcolor: 'rgba(20, 32, 23, 0.72)',
        backgroundImage: 'linear-gradient(165deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.04) 42%, transparent 55%, rgba(220, 192, 126, 0.06) 100%)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid rgba(255, 255, 255, 0.24)',
        borderRadius: '999px',
        boxShadow: '0 8px 28px rgba(10, 20, 12, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.32), inset 0 -1px 0 rgba(255, 255, 255, 0.06)',
        px: 0.75,
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '8%',
          right: '8%',
          height: '45%',
          borderRadius: '0 0 50% 50%',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent)',
          pointerEvents: 'none',
        },
      }}
    >
      {tabs.map(({ label, to, icon: Icon }) => {
        const isStart = to === '/campaigns/new'
        const active = pathname === to || (to === '/explore' && (
          (pathname.startsWith('/campaigns/') && pathname !== '/campaigns/new') || pathname.startsWith('/c/')
        ))

        return (
          <ButtonBase
            key={to}
            component={RouterLink}
            to={to}
            aria-label={isStart ? 'Start a campaign' : label}
            aria-current={active ? 'page' : undefined}
            sx={{
              minWidth: 0,
              height: 72,
              borderRadius: '999px',
              flexDirection: 'column',
              gap: 0.5,
              color: active || isStart ? '#F0D592' : '#EEF1EB',
              fontFamily: '"Outfit", sans-serif',
              fontSize: '0.6875rem',
              fontWeight: active ? 750 : 600,
              '&:focus-visible': { outline: '2px solid #DCC07E', outlineOffset: -4 },
              '&:hover .tab-icon': { bgcolor: isStart ? '#DCC07E' : 'rgba(168, 181, 160, 0.22)' },
            }}
          >
            <Box
              className="tab-icon"
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: isStart ? 48 : 52,
                height: 32,
                borderRadius: '999px',
                bgcolor: isStart ? '#C7A24A' : active ? 'rgba(168, 181, 160, 0.22)' : 'transparent',
                backgroundImage: isStart || active ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0))' : 'none',
                boxShadow: isStart || active ? 'inset 0 1px 0 rgba(255, 255, 255, 0.26)' : 'none',
                color: isStart ? '#1C261D' : 'inherit',
              }}
            >
              <Icon sx={{ fontSize: isStart ? 28 : 23 }} />
            </Box>
            {label}
          </ButtonBase>
        )
      })}
    </Box>
  )
}
