import { AccountAgreementNotice } from '../auth/AccountAgreement'
import { useEffect } from 'react'
import Box from '@mui/material/Box'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { WebsiteRequestNotice } from '../auth/WebsiteRequestNotice'
import { MobileBottomNav } from './MobileBottomNav'

/** Target of the skip link: the page content, after the header navigation. */
export const MAIN_CONTENT_ID = 'main-content'

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
      {/* First focusable element: lets keyboard users jump past the header
          navigation (WCAG 2.4.1). Hidden until focused. Focus is moved by hand
          so the router never sees a hash change. */}
      <Box
        component="a"
        href={`#${MAIN_CONTENT_ID}`}
        onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault()
          document.getElementById(MAIN_CONTENT_ID)?.focus()
        }}
        sx={{
          position: 'absolute',
          left: 16,
          top: -64,
          zIndex: (theme) => theme.zIndex.tooltip + 1,
          px: 2,
          py: 1,
          borderRadius: 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          fontWeight: 700,
          boxShadow: 3,
          textDecoration: 'none',
          '&:focus': { top: 16 },
        }}
      >
        Skip to main content
      </Box>
      <Header />
      <Box component="main" id={MAIN_CONTENT_ID} tabIndex={-1} sx={{ flex: 1, '&:focus': { outline: 'none' } }}>
        <WebsiteRequestNotice />
        <AccountAgreementNotice />
        <Box key={pathname} className="uf-page-enter">
          <Outlet />
        </Box>
      </Box>
      <Footer />
      <MobileBottomNav />
    </Box>
  )
}
