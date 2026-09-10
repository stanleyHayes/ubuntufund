import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import useMediaQuery from '@mui/material/useMediaQuery'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import {
  createUjimoraTheme,
  ttSquaresFontFace,
  applySkinVars,
  type ThemeSkin,
} from '@ubuntu-fund/ui'

interface ColorModeValue {
  darkMode: boolean
  setDarkMode: (enabled: boolean) => void
  skin: ThemeSkin
  setSkin: (skin: ThemeSkin) => void
}

const ColorModeContext = createContext<ColorModeValue | null>(null)
const SKINS: ThemeSkin[] = ['neumorphism', 'claymorphism', 'glassmorphism', 'minimal']

// Minimal + glass define their surface with a border; glass additionally frosts
// with a backdrop blur over a non-flat ground. Scope the border to those two
// skins so neumorphism/claymorphism keep their borderless embossed surfaces.
const skinGlobalStyles = {
  '[data-skin="minimal"] .MuiPaper-root, [data-skin="minimal"] .MuiCard-root, [data-skin="glassmorphism"] .MuiPaper-root, [data-skin="glassmorphism"] .MuiCard-root':
    {
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
  const [darkMode, setDarkModeState] = useState(
    () => localStorage.getItem('uf_color_mode') === 'dark',
  )
  const [skin, setSkinState] = useState<ThemeSkin>(() => {
    const s = localStorage.getItem('uf_skin')
    return s && (SKINS as string[]).includes(s) ? (s as ThemeSkin) : 'neumorphism'
  })
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const theme = useMemo(
    () =>
      createTheme(createUjimoraTheme(darkMode ? 'dark' : 'light', skin), {
        transitions: {
          easing: {
            easeOut: 'cubic-bezier(.22, 1, .36, 1)',
            easeInOut: 'cubic-bezier(.4, 0, .2, 1)',
          },
          duration: {
            shortest: reducedMotion ? 0 : 120,
            shorter: reducedMotion ? 0 : 160,
            short: reducedMotion ? 0 : 200,
            standard: reducedMotion ? 0 : 240,
            complex: reducedMotion ? 0 : 280,
            enteringScreen: reducedMotion ? 0 : 240,
            leavingScreen: reducedMotion ? 0 : 160,
          },
        },
      }),
    [darkMode, skin, reducedMotion],
  )

  // Re-apply the skin's CSS vars (inline on :root, so they override the theme's
  // CssBaseline defaults) and stamp data-skin whenever skin or mode changes.
  useLayoutEffect(() => {
    applySkinVars(skin, darkMode)
    document.documentElement.dataset.skin = skin
  }, [skin, darkMode])

  const setDarkMode = useCallback((enabled: boolean) => {
    setDarkModeState(enabled)
    try {
      localStorage.setItem('uf_color_mode', enabled ? 'dark' : 'light')
    } catch {
      /* private mode */
    }
  }, [])

  const setSkin = useCallback((next: ThemeSkin) => {
    setSkinState(next)
    try {
      localStorage.setItem('uf_skin', next)
    } catch {
      /* private mode */
    }
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
