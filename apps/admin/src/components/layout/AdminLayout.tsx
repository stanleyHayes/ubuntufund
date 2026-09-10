import { AdminActionProvider } from '@/context/AdminActionContext'
import { useEffect, useState } from 'react'
import { Box, LinearProgress } from '@mui/material'
import { Outlet, useNavigation, useLocation } from 'react-router-dom'
import { keyframes } from '@emotion/react'

// Route enter animation (reduced-motion aware; re-triggered per pathname key).
const pageIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
`
import Sidebar, { DRAWER_WIDTH } from './Sidebar'
import TopBar, { TOPBAR_HEIGHT } from './TopBar'
import Tour, { type TourStep } from '@/components/Tour'
import { useAuth } from '@/context/AuthContext'

const ADMIN_TOUR: TourStep[] = [
  {
    title: 'Welcome to the Ujimora console',
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
  const { pathname } = useLocation()
  const [tourOpen, setTourOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Reset scroll to the top on route change (avoids opening a page mid-scroll).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])

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
    <AdminActionProvider>
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
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <TopBar onReplayTour={() => setTourOpen(true)} onOpenNav={() => setMobileNavOpen(true)} />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
            minWidth: 0,
            bgcolor: 'background.default',
            minHeight: '100vh',
          }}
        >
          <Box sx={{ height: `${TOPBAR_HEIGHT}px` }} />
          <Box
            key={pathname}
            sx={{
              p: 3,
              animation: `${pageIn} 0.3s cubic-bezier(0.22, 1, 0.36, 1)`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            <Outlet />
          </Box>
        </Box>
        {tourOpen && <Tour steps={ADMIN_TOUR} onDone={closeTour} />}
      </Box>
    </AdminActionProvider>
  )
}
