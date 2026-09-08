import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router-dom'
import { Box, useMediaQuery } from '@mui/material'
import { keyframes } from '@emotion/react'
import { scrollToHash } from '../lib/scroll'

const enter = keyframes`from { opacity: 0; } to { opacity: 1; }`

/** Keep the outgoing route mounted briefly, then reveal the next route. */
export default function PageTransitions({ children }: { children: (location: Location) => ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [displayed, setDisplayed] = useState(location)
  const [keyboard, setKeyboard] = useState(false)
  const immediate = reduceMotion || keyboard
  const changingPage = location.pathname !== displayed.pathname
  const visibleLocation = immediate || !changingPage ? location : displayed

  useEffect(() => {
    const timer = window.setTimeout(() => setDisplayed(location), changingPage && !immediate ? 150 : 0)
    return () => window.clearTimeout(timer)
  }, [location, changingPage, immediate])

  useLayoutEffect(() => {
    if (visibleLocation.hash) scrollToHash(visibleLocation.hash.slice(1))
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [visibleLocation.pathname, visibleLocation.hash])

  useEffect(() => {
    const onKey = () => { setKeyboard(true) }
    const onPointer = () => { setKeyboard(false) }
    // Native MUI href links should navigate within the SPA too. Preserve router
    // links, downloads, new tabs, external URLs, and ordinary section anchors.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element)?.closest?.('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
      const url = new URL(anchor.href)
      if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      event.preventDefault()
      navigate(`${url.pathname}${url.search}${url.hash}`)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('click', onClick)
    }
  }, [navigate])

  return (
    <Box data-page-transition={changingPage && !immediate ? 'leaving' : 'ready'} sx={{
      opacity: changingPage && !immediate ? .15 : 1,
      transition: immediate ? 'none' : 'opacity 150ms cubic-bezier(.22,1,.36,1)',
      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    }}>
      <Box key={visibleLocation.pathname} sx={{
        animation: immediate ? 'none' : `${enter} 380ms cubic-bezier(.22,1,.36,1) both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}>
        {children(visibleLocation)}
      </Box>
    </Box>
  )
}
