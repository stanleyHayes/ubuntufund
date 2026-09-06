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
  getGlass,
  type ColorScheme,
  type Palette,
  type NeuRecipes,
  type Skin,
  type GlassConfig,
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
const SKIN_STORAGE_KEY = 'uf_skin'

const VALID_SKINS: Skin[] = ['neumorphism', 'claymorphism', 'glassmorphism', 'minimal']

interface ColorModeValue {
  /** The user's stored preference. */
  mode: ColorModePreference
  /** The resolved scheme actually in effect ('light' | 'dark'). */
  scheme: ColorScheme
  /** The user's chosen design finish. */
  skin: Skin
  /** Active palette for the resolved scheme. */
  palette: Palette
  /** Active surface recipes for the resolved scheme + skin. */
  neu: NeuRecipes
  /** Backdrop-blur config for the glass skin (use with the GlassSurface component). */
  glass: GlassConfig
  /** Active react-native-paper theme for the resolved scheme. */
  paperTheme: MD3Theme
  /** Persist a new appearance preference. */
  setMode: (mode: ColorModePreference) => void
  /** Persist a new design finish. */
  setSkin: (skin: Skin) => void
}

const ColorModeContext = createContext<ColorModeValue | undefined>(undefined)

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() // 'light' | 'dark' | null
  const [mode, setModeState] = useState<ColorModePreference>('system')
  const [skin, setSkinState] = useState<Skin>('neumorphism')

  // Hydrate the persisted preferences once on mount.
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
    AsyncStorage.getItem(SKIN_STORAGE_KEY)
      .then((stored) => {
        if (active && stored && (VALID_SKINS as string[]).includes(stored)) {
          setSkinState(stored as Skin)
        }
      })
      .catch(() => {
        /* no stored finish — keep 'neumorphism' */
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

  const setSkin = (next: Skin) => {
    setSkinState(next)
    AsyncStorage.setItem(SKIN_STORAGE_KEY, next).catch(() => {
      /* best-effort persistence; the in-memory choice still applies */
    })
  }

  const scheme: ColorScheme =
    mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode

  const value = useMemo<ColorModeValue>(
    () => ({
      mode,
      scheme,
      skin,
      palette: getPalette(scheme),
      neu: getNeu(scheme, skin),
      glass: getGlass(scheme),
      paperTheme: getPaperTheme(scheme),
      setMode,
      setSkin,
    }),
    [mode, scheme, skin],
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

/** Just the active surface recipes for the current scheme + skin. */
export function useNeu(): NeuRecipes {
  return useColorMode().neu
}

/** The active design finish + its setter. */
export function useSkin(): { skin: Skin; setSkin: (skin: Skin) => void } {
  const { skin, setSkin } = useColorMode()
  return { skin, setSkin }
}
