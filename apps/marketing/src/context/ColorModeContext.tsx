import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { createUjimoraTheme, ttSquaresFontFace, applySkinVars, revealThemeChange, themeTransitionStyles, reducedMotionStyles, type ThemeSkin } from '@ubuntu-fund/ui'
import { COLOR_MODE_KEY, SKIN_KEY, readStoredLook } from '@/lib/hydration'

interface ColorModeValue {
  darkMode: boolean
  setDarkMode: (enabled: boolean) => void
  skin: ThemeSkin
  setSkin: (skin: ThemeSkin) => void
}

const ColorModeContext = createContext<ColorModeValue | null>(null)

// Minimal + glass define surfaces with a border; glass also frosts over a
// non-flat ground. Scoped so the embossed skins keep their borderless surfaces.
const skinGlobalStyles = {
  '[data-skin="minimal"] .MuiPaper-root, [data-skin="minimal"] .MuiCard-root, [data-skin="glassmorphism"] .MuiPaper-root, [data-skin="glassmorphism"] .MuiCard-root': {
    border: 'var(--neu-border)',
  },
  '[data-skin="glassmorphism"] .MuiPaper-root, [data-skin="glassmorphism"] .MuiCard-root': {
    backdropFilter: 'var(--neu-backdrop)',
    WebkitBackdropFilter: 'var(--neu-backdrop)',
  },
  '[data-skin="glassmorphism"] body': {
    backgroundImage:
      'radial-gradient(circle at 12% 18%, rgba(199,162,74,0.18), transparent 42%), radial-gradient(circle at 88% 82%, rgba(46,61,47,0.22), transparent 46%)',
    backgroundAttachment: 'fixed',
  },
} as const

export function ColorModeProvider({ children }: { children: ReactNode }) {
  // On the server (no storage) this is the default look, which every page is
  // prerendered in. main.tsx only hydrates when the stored look is that same
  // default, so this first render always matches the HTML it adopts.
  const [darkMode, setDarkModeState] = useState(() => readStoredLook().darkMode)
  const [skin, setSkinState] = useState<ThemeSkin>(() => readStoredLook().skin)
  const theme = useMemo(() => createUjimoraTheme(darkMode ? 'dark' : 'light', skin), [darkMode, skin])

  useLayoutEffect(() => {
    applySkinVars(skin, darkMode)
    document.documentElement.dataset.skin = skin
  }, [skin, darkMode])

  const setDarkMode = useCallback((enabled: boolean) => {
    // Circular reveal from wherever the member touched; falls straight
    // through to a plain swap without View Transitions or under
    // prefers-reduced-motion.
    revealThemeChange(() => setDarkModeState(enabled))
    try { localStorage.setItem(COLOR_MODE_KEY, enabled ? 'dark' : 'light') } catch { /* private mode */ }
  }, [])

  const setSkin = useCallback((next: ThemeSkin) => {
    setSkinState(next)
    try { localStorage.setItem(SKIN_KEY, next) } catch { /* private mode */ }
  }, [])

  return (
    <ColorModeContext.Provider value={{ darkMode, setDarkMode, skin, setSkin }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={ttSquaresFontFace} />
        <GlobalStyles styles={skinGlobalStyles} />
        <GlobalStyles styles={themeTransitionStyles} />
        <GlobalStyles styles={reducedMotionStyles} />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

export function useColorMode() {
  const value = useContext(ColorModeContext)
  if (!value) throw new Error('useColorMode must be used within ColorModeProvider')
  return value
}
