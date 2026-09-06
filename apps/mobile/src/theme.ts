import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper'
import type { MD3Theme } from 'react-native-paper'
import type { ViewStyle } from 'react-native'

// ---------------------------------------------------------------------------
// Palette
//
// `Palette` is the semantic surface every screen paints from. There are two
// concrete palettes — `lightPalette` and `darkPalette` — with the SAME keys, so
// a screen reads `p.text` / `p.primary` and gets the value for the active mode.
// The light values are the historical brand colors (kept, so existing code
// keeps compiling); the dark values are tuned for contrast on a dark ground
// (e.g. `primary` lightens to the sage green so it stays legible as both an
// accent fill AND as text/icon on a dark surface).
//
// Beyond the brand hues, the palette also names the tokens screens used to
// hardcode inline — `border`, `skeleton`, `onPrimary`, `overlay`, `ripple` —
// so dark mode gets correct hairlines and placeholders instead of light ones.
// ---------------------------------------------------------------------------

export interface Palette {
  primary: string
  primaryLight: string
  primaryDark: string
  secondary: string
  secondaryLight: string
  secondaryDark: string
  error: string
  success: string
  warning: string
  /** App background (screen ground). */
  background: string
  /** Default card / raised-surface ground. */
  surface: string
  /** Highest elevation surface (was pure white in light). */
  surfaceWhite: string
  /** Primary body text. */
  text: string
  /** Muted / secondary text. */
  textSecondary: string
  /** Text/icon that sits on top of a `primary` fill. */
  onPrimary: string
  /** Hairline divider / border. */
  border: string
  /** Skeleton-shimmer block color. */
  skeleton: string
  /** Modal / scrim overlay. */
  overlay: string
  /** Touchable ripple tint. */
  ripple: string
}

export const lightPalette: Palette = {
  primary: '#2E3D2F',
  primaryLight: '#5E8F72',
  primaryDark: '#1C261D',
  secondary: '#C7A24A',
  secondaryLight: '#DCC07E',
  secondaryDark: '#A07E33',
  error: '#A5432F',
  success: '#2F6B46',
  warning: '#B98A2E',
  background: '#F2EFEA',
  surface: '#F2EFEA',
  surfaceWhite: '#FFFFFF',
  text: '#1A2E22',
  textSecondary: '#4A5A50',
  onPrimary: '#FFFFFF',
  border: 'rgba(26,46,34,0.08)',
  skeleton: '#E0E0E0',
  overlay: 'rgba(0,0,0,0.45)',
  ripple: 'rgba(26,46,34,0.08)',
}

export const darkPalette: Palette = {
  // Green lightens so it reads as both a fill and as text/icon on dark.
  primary: '#79A98C',
  primaryLight: '#8FBBA0',
  primaryDark: '#12180F',
  secondary: '#D8B75E',
  secondaryLight: '#E4CE93',
  secondaryDark: '#E4CE93',
  error: '#EF6E58',
  success: '#5FB07E',
  warning: '#D8B24E',
  background: '#121212',
  surface: '#1E1E1E',
  surfaceWhite: '#242424',
  text: '#E8EAE6',
  textSecondary: '#A6AEA8',
  onPrimary: '#0F140F',
  border: 'rgba(255,255,255,0.10)',
  skeleton: '#2A2A2A',
  overlay: 'rgba(0,0,0,0.6)',
  ripple: 'rgba(255,255,255,0.10)',
}

export type ColorScheme = 'light' | 'dark'

export function getPalette(scheme: ColorScheme): Palette {
  return scheme === 'dark' ? darkPalette : lightPalette
}

/**
 * Backwards-compatible flat export. Points at the LIGHT palette so any screen
 * not yet migrated to the mode-aware `usePalette()` hook keeps its original
 * appearance and keeps compiling. New/migrated code should read the palette
 * from the hook instead.
 */
export const brandColors = lightPalette

// ---------------------------------------------------------------------------
// Neumorphism recipes (mode-aware)
//
// The raised/subtle/inset recipes carry the soft double-shadow that gives the
// app its tactile surfaces. Light uses a warm parchment ground; dark uses a
// near-black ground with a lifted highlight so the same geometry still reads.
// ---------------------------------------------------------------------------

export interface NeuRecipes {
  raised: ViewStyle
  subtle: ViewStyle
  inset: ViewStyle
  greenRaised: ViewStyle
  greenSubtle: ViewStyle
  greenInset: ViewStyle
}

const lightNeu: NeuRecipes = {
  raised: {
    backgroundColor: '#F2EFEA',
    boxShadow: '7px 7px 16px rgba(72,62,43,0.16), -7px -7px 16px rgba(255,255,255,0.96)',
    shadowColor: '#493F30',
    shadowOffset: { width: 6, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 7,
  },
  subtle: {
    backgroundColor: '#F2EFEA',
    boxShadow: '4px 4px 10px rgba(72,62,43,0.14), -4px -4px 10px rgba(255,255,255,0.94)',
    shadowColor: '#493F30',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  inset: {
    backgroundColor: '#E9E5DE',
    boxShadow: 'inset 3px 3px 8px rgba(72,62,43,0.15), inset -3px -3px 8px rgba(255,255,255,0.94)',
  },
  greenRaised: {
    backgroundColor: '#2E3D2F',
    boxShadow: '7px 7px 16px rgba(0,0,0,0.38), -7px -7px 16px rgba(94,143,114,0.18)',
    shadowColor: '#000000',
    shadowOffset: { width: 6, height: 7 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 8,
  },
  greenSubtle: {
    backgroundColor: '#2E3D2F',
    boxShadow: '4px 4px 10px rgba(0,0,0,0.34), -4px -4px 10px rgba(94,143,114,0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  greenInset: {
    backgroundColor: '#2E3D2F',
    boxShadow: 'inset 3px 3px 8px rgba(0,0,0,0.38), inset -3px -3px 8px rgba(94,143,114,0.15)',
  },
}

const darkNeu: NeuRecipes = {
  raised: {
    backgroundColor: '#1E1E1E',
    boxShadow: '7px 7px 16px rgba(0,0,0,0.55), -7px -7px 16px rgba(255,255,255,0.04)',
    shadowColor: '#000000',
    shadowOffset: { width: 6, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 7,
  },
  subtle: {
    backgroundColor: '#1E1E1E',
    boxShadow: '4px 4px 10px rgba(0,0,0,0.5), -4px -4px 10px rgba(255,255,255,0.03)',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  inset: {
    backgroundColor: '#171717',
    boxShadow: 'inset 3px 3px 8px rgba(0,0,0,0.6), inset -3px -3px 8px rgba(255,255,255,0.03)',
  },
  greenRaised: {
    backgroundColor: '#243026',
    boxShadow: '7px 7px 16px rgba(0,0,0,0.6), -7px -7px 16px rgba(121,169,140,0.10)',
    shadowColor: '#000000',
    shadowOffset: { width: 6, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  greenSubtle: {
    backgroundColor: '#243026',
    boxShadow: '4px 4px 10px rgba(0,0,0,0.55), -4px -4px 10px rgba(121,169,140,0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 5,
  },
  greenInset: {
    backgroundColor: '#243026',
    boxShadow: 'inset 3px 3px 8px rgba(0,0,0,0.6), inset -3px -3px 8px rgba(121,169,140,0.08)',
  },
}

export function getNeu(scheme: ColorScheme): NeuRecipes {
  return scheme === 'dark' ? darkNeu : lightNeu
}

/**
 * Backwards-compatible flat export (LIGHT recipes) for screens not yet migrated
 * to `useNeu()`. Migrated code should read the recipes from the hook.
 */
export const neumorphism = lightNeu

// ---------------------------------------------------------------------------
// Fonts + Paper themes
// ---------------------------------------------------------------------------

// Configure all MD3 type scales to use TT Squares / Outfit.
const fontConfig = {
  displayLarge: { fontFamily: 'Outfit_800ExtraBold' },
  displayMedium: { fontFamily: 'Outfit_800ExtraBold' },
  displaySmall: { fontFamily: 'Outfit_700Bold' },
  headlineLarge: { fontFamily: 'Outfit_800ExtraBold' },
  headlineMedium: { fontFamily: 'Outfit_700Bold' },
  headlineSmall: { fontFamily: 'Outfit_700Bold' },
  titleLarge: { fontFamily: 'Outfit_700Bold' },
  titleMedium: { fontFamily: 'Outfit_700Bold' },
  titleSmall: { fontFamily: 'Outfit_700Bold' },
  labelLarge: { fontFamily: 'Outfit_600SemiBold' },
  labelMedium: { fontFamily: 'Outfit_500Medium' },
  labelSmall: { fontFamily: 'Outfit_500Medium' },
  bodyLarge: { fontFamily: 'Outfit_400Regular' },
  bodyMedium: { fontFamily: 'Outfit_400Regular' },
  bodySmall: { fontFamily: 'Outfit_400Regular' },
} as const

const fonts = configureFonts({ config: fontConfig })

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: lightPalette.primary,
    primaryContainer: lightPalette.primaryLight,
    secondary: lightPalette.secondary,
    secondaryContainer: lightPalette.secondaryLight,
    error: lightPalette.error,
    background: lightPalette.background,
    surface: lightPalette.surface,
    onPrimary: '#FFFFFF',
    onSecondary: '#212121',
    onBackground: lightPalette.text,
    onSurface: lightPalette.text,
  },
}

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkPalette.primary,
    primaryContainer: darkPalette.primaryDark,
    secondary: darkPalette.secondary,
    secondaryContainer: darkPalette.secondaryDark,
    error: darkPalette.error,
    background: darkPalette.background,
    surface: darkPalette.surface,
    onPrimary: darkPalette.onPrimary,
    onSecondary: '#212121',
    onBackground: darkPalette.text,
    onSurface: darkPalette.text,
  },
}

export function getPaperTheme(scheme: ColorScheme): MD3Theme {
  return scheme === 'dark' ? darkTheme : lightTheme
}
