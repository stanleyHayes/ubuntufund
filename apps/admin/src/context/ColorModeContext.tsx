import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { ttSquaresFontFace, applySkinVars, type ThemeSkin } from '@ubuntu-fund/ui'
import { makeAdminTheme } from '../theme'

interface ColorModeValue {
  darkMode: boolean
  setDarkMode: (enabled: boolean) => void
  skin: ThemeSkin
  setSkin: (skin: ThemeSkin) => void
}

const ColorModeContext = createContext<ColorModeValue | null>(null)
const SKINS: ThemeSkin[] = ['neumorphism', 'claymorphism', 'glassmorphism', 'minimal']

// Frosted glass needs a backdrop blur + hairline border on surfaces, and a
// non-flat backdrop worth blurring — scoped to the glass skin only so the other
// skins are untouched. Neumorphism/claymorphism keep the theme's flat ground.
const skinGlobalStyles = {
  '[data-skin="glassmorphism"] .MuiPaper-root, [data-skin="glassmorphism"] .MuiCard-root': {
    backdropFilter: 'var(--neu-backdrop)',
    WebkitBackdropFilter: 'var(--neu-backdrop)',
    border: 'var(--neu-border)',
  },
  '[data-skin="glassmorphism"] body': {
    backgroundImage:
      'radial-gradient(circle at 12% 18%, rgba(199,162,74,0.18), transparent 42%), radial-gradient(circle at 88% 82%, rgba(46,61,47,0.22), transparent 46%)',
    backgroundAttachment: 'fixed',
  },
} as const

export function ColorModeProvider({ children }: { children: ReactNode }) {
  // Admin is dark-first: default to dark when nothing is stored yet.
  const [darkMode, setDarkModeState] = useState(() => localStorage.getItem('uf_admin_color_mode') !== 'light')
  const [skin, setSkinState] = useState<ThemeSkin>(() => {
    const s = localStorage.getItem('uf_admin_skin')
    return s && (SKINS as string[]).includes(s) ? (s as ThemeSkin) : 'neumorphism'
  })
  const theme = useMemo(() => makeAdminTheme(darkMode ? 'dark' : 'light', skin), [darkMode, skin])

  // Re-apply the skin's CSS vars (inline on :root, so they override the theme's
  // CssBaseline defaults) and stamp data-skin whenever skin or mode changes.
  useLayoutEffect(() => {
    applySkinVars(skin, darkMode)
    document.documentElement.dataset.skin = skin
  }, [skin, darkMode])

  const setDarkMode = useCallback((enabled: boolean) => {
    setDarkModeState(enabled)
    try { localStorage.setItem('uf_admin_color_mode', enabled ? 'dark' : 'light') } catch { /* private mode */ }
  }, [])

  const setSkin = useCallback((next: ThemeSkin) => {
    setSkinState(next)
    try { localStorage.setItem('uf_admin_skin', next) } catch { /* private mode */ }
  }, [])

  return (
    <ColorModeContext.Provider value={{ darkMode, setDarkMode, skin, setSkin }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={ttSquaresFontFace} />
        <GlobalStyles styles={skinGlobalStyles} />
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
