import { useEffect } from 'react'
import Box from '@mui/material/Box'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { MobileBottomNav } from './MobileBottomNav'

export function Layout() {
  const { pathname } = useLocation()

  // Reset scroll to the top on every route change — otherwise a new page opens
  // at the previous page's scroll position ("jumps from bottom to top").
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  return (
    <Box
      sx={{
        '--mobile-nav-height': { xs: 'calc(98px + env(safe-area-inset-bottom, 0px))', md: '0px' },
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        '& .MuiSnackbar-anchorOriginBottomLeft, & .MuiSnackbar-anchorOriginBottomCenter, & .MuiSnackbar-anchorOriginBottomRight':
          {
            bottom: { xs: 'calc(var(--mobile-nav-height) + 16px)', md: 24 },
          },
      }}
    >
      <Header />
      <Box component="main" sx={{ flex: 1 }}>
        <Box key={pathname} className="uf-page-enter">
          <Outlet />
        </Box>
      </Box>
      <Footer />
      <MobileBottomNav />
    </Box>
  )
}
