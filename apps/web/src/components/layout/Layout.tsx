import { useEffect } from 'react'
import Box from '@mui/material/Box'
import { Outlet, useLocation } from 'react-router-dom'
import { keyframes } from '@emotion/react'
import { Header } from './Header'
import { Footer } from './Footer'

// Enter transition for each route. Keying the wrapper on the pathname remounts
// it on navigation, re-triggering the animation. Reduced-motion users get none.
const pageIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
`

export function Layout() {
  const { pathname } = useLocation()

  // Reset scroll to the top on every route change — otherwise a new page opens
  // at the previous page's scroll position ("jumps from bottom to top").
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <Box component="main" sx={{ flex: 1 }}>
        <Box
          key={pathname}
          sx={{
            animation: `${pageIn} 0.32s cubic-bezier(0.22, 1, 0.36, 1)`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <Outlet />
        </Box>
      </Box>
      <Footer />
    </Box>
  )
}
