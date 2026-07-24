import { useEffect, useState } from 'react'
import { Box, LinearProgress } from '@mui/material'
import { Outlet, useNavigation } from 'react-router-dom'
import Sidebar, { DRAWER_WIDTH } from './Sidebar'
import TopBar, { TOPBAR_HEIGHT } from './TopBar'
import Tour, { type TourStep } from '@/components/Tour'
import { useAuth } from '@/context/AuthContext'

const ADMIN_TOUR: TourStep[] = [
  {
    title: 'Welcome to the UbuntuFund console',
    body: "This is where you steward the platform — campaigns, donors, disputes, and payouts. Sixty seconds and you'll know your way around.",
  },
  {
    selector: '[data-tour="sidebar"]',
    side: 'right',
    title: 'Your sections',
    body: 'Everything lives in five groups: Operations for the daily pulse, Community for campaigns and people, Trust & Safety for reviews, Growth for outreach, and Platform for configuration.',
  },
  {
    selector: '[data-tour="search"]',
    side: 'bottom',
    title: 'Search everything',
    body: 'Jump straight to any campaign, user, or donation without leaving the page you are on.',
  },
  {
    selector: '[data-tour="bell"]',
    side: 'bottom',
    title: 'Notifications',
    body: 'Verification requests, disputes, and platform alerts land here. The count updates as you work.',
  },
  {
    selector: '[data-tour="user-menu"]',
    side: 'bottom',
    title: 'Your account',
    body: 'Your profile, settings, and a replay of this tour live in this menu — along with sign out.',
  },
  {
    selector: 'main',
    side: 'top',
    title: 'The workspace',
    body: 'Pages open here. The dashboard keeps a pulse on the platform — donations, campaign health, and what needs your attention.',
  },
]

function tourKey(userId: string | undefined) {
  return `uf.admin.tourSeen.${userId ?? 'anon'}`
}

export default function AdminLayout() {
  const navigation = useNavigation()
  const { user } = useAuth()
  const [tourOpen, setTourOpen] = useState(false)

  // Auto-start once per user, desktop only, after the chrome settles.
  useEffect(() => {
    if (!user) return
    if (window.innerWidth < 1024) return
    if (localStorage.getItem(tourKey(user.id))) return
    const timer = setTimeout(() => setTourOpen(true), 900)
    return () => clearTimeout(timer)
  }, [user])

  const closeTour = () => {
    setTourOpen(false)
    localStorage.setItem(tourKey(user?.id), '1')
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {navigation.state !== 'idle' && (
        <LinearProgress
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2200,
            height: 2,
            bgcolor: 'transparent',
            '& .MuiLinearProgress-bar': { bgcolor: '#C7A24A' },
          }}
        />
      )}
      <Sidebar />
      <TopBar onReplayTour={() => setTourOpen(true)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Box sx={{ height: `${TOPBAR_HEIGHT}px` }} />
        <Box sx={{ p: 3 }}>
          <Outlet />
        </Box>
      </Box>
      {tourOpen && <Tour steps={ADMIN_TOUR} onDone={closeTour} />}
    </Box>
  )
}
