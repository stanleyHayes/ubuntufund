import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { createUjimoraTheme, ttSquaresFontFace } from '@ubuntu-fund/ui'

interface ColorModeValue {
  darkMode: boolean
  setDarkMode: (enabled: boolean) => void
}

const ColorModeContext = createContext<ColorModeValue | null>(null)

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkModeState] = useState(() => localStorage.getItem('uf_color_mode') === 'dark')
  const theme = useMemo(() => createUjimoraTheme(darkMode ? 'dark' : 'light'), [darkMode])

  const setDarkMode = useCallback((enabled: boolean) => {
    setDarkModeState(enabled)
    localStorage.setItem('uf_color_mode', enabled ? 'dark' : 'light')
    document.documentElement.style.colorScheme = enabled ? 'dark' : 'light'
  }, [])

  return (
    <ColorModeContext.Provider value={{ darkMode, setDarkMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={ttSquaresFontFace} />
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
