import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getPalette,
  getNeu,
  getPaperTheme,
  type ColorScheme,
  type Palette,
  type NeuRecipes,
} from '@/theme'
import type { MD3Theme } from 'react-native-paper'

// ---------------------------------------------------------------------------
// Color mode
//
// Holds the user's appearance preference — 'light' | 'dark' | 'system' —
// persisted across launches, and resolves it against the OS setting into the
// active `scheme`. Screens read the mode-aware `palette` / `neu` from the
// `usePalette()` / `useNeu()` hooks so a single toggle recolors the whole app.
// Default is 'system', so a device in light mode is unaffected until the user
// opts into dark.
// ---------------------------------------------------------------------------

export type ColorModePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'uf_color_mode'

interface ColorModeValue {
  /** The user's stored preference. */
  mode: ColorModePreference
  /** The resolved scheme actually in effect ('light' | 'dark'). */
  scheme: ColorScheme
  /** Active palette for the resolved scheme. */
  palette: Palette
  /** Active neumorphism recipes for the resolved scheme. */
  neu: NeuRecipes
  /** Active react-native-paper theme for the resolved scheme. */
  paperTheme: MD3Theme
  /** Persist a new preference. */
  setMode: (mode: ColorModePreference) => void
}

const ColorModeContext = createContext<ColorModeValue | undefined>(undefined)

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() // 'light' | 'dark' | null
  const [mode, setModeState] = useState<ColorModePreference>('system')

  // Hydrate the persisted preference once on mount.
  useEffect(() => {
    let active = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setModeState(stored)
        }
      })
      .catch(() => {
        /* no stored preference (or storage unavailable) — keep 'system' */
      })
    return () => {
      active = false
    }
  }, [])

  const setMode = (next: ColorModePreference) => {
    setModeState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      /* best-effort persistence; the in-memory choice still applies */
    })
  }

  const scheme: ColorScheme =
    mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode

  const value = useMemo<ColorModeValue>(
    () => ({
      mode,
      scheme,
      palette: getPalette(scheme),
      neu: getNeu(scheme),
      paperTheme: getPaperTheme(scheme),
      setMode,
    }),
    [mode, scheme],
  )

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>
}

export function useColorMode(): ColorModeValue {
  const ctx = useContext(ColorModeContext)
  if (!ctx) {
    throw new Error('useColorMode must be used within a ColorModeProvider')
  }
  return ctx
}

/** Just the active palette — the common case in screen styles. */
export function usePalette(): Palette {
  return useColorMode().palette
}

/** Just the active neumorphism recipes. */
export function useNeu(): NeuRecipes {
  return useColorMode().neu
}
