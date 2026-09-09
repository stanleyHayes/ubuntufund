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

const lightPalette: Palette = {
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

const darkPalette: Palette = {
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

// ---------------------------------------------------------------------------
// Claymorphism — puffy, matte, softly-rounded surfaces (outer shadow + inset
// highlight/shade). Same NeuRecipes shape, so every surface that reads a recipe
// through useNeu() gets it for free.
// ---------------------------------------------------------------------------

const lightClay: NeuRecipes = {
  raised: {
    backgroundColor: '#EDE8DF',
    boxShadow:
      '8px 10px 22px rgba(72,62,43,0.16), -6px -6px 14px rgba(255,255,255,0.95), inset 3px 3px 6px rgba(255,255,255,0.75), inset -5px -5px 10px rgba(72,62,43,0.06)',
    shadowColor: '#493F30',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  subtle: {
    backgroundColor: '#EDE8DF',
    boxShadow:
      '5px 6px 14px rgba(72,62,43,0.14), -4px -4px 10px rgba(255,255,255,0.9), inset 2px 2px 4px rgba(255,255,255,0.7), inset -3px -3px 7px rgba(72,62,43,0.05)',
    shadowColor: '#493F30',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 9,
    elevation: 5,
  },
  inset: {
    backgroundColor: '#E4DED3',
    boxShadow:
      'inset 5px 5px 10px rgba(72,62,43,0.14), inset -5px -5px 10px rgba(255,255,255,0.92)',
  },
  greenRaised: {
    backgroundColor: '#31402F',
    boxShadow:
      '8px 10px 22px rgba(0,0,0,0.4), -5px -5px 12px rgba(94,143,114,0.18), inset 3px 3px 6px rgba(150,190,160,0.16), inset -5px -5px 10px rgba(0,0,0,0.28)',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 9,
  },
  greenSubtle: {
    backgroundColor: '#31402F',
    boxShadow:
      '5px 6px 14px rgba(0,0,0,0.34), -4px -4px 10px rgba(94,143,114,0.14), inset 2px 2px 4px rgba(150,190,160,0.14), inset -3px -3px 7px rgba(0,0,0,0.24)',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 9,
    elevation: 6,
  },
  greenInset: {
    backgroundColor: '#2B3A2C',
    boxShadow:
      'inset 5px 5px 10px rgba(0,0,0,0.4), inset -5px -5px 10px rgba(94,143,114,0.16)',
  },
}

const darkClay: NeuRecipes = {
  raised: {
    backgroundColor: '#232019',
    boxShadow:
      '8px 10px 22px rgba(0,0,0,0.55), -6px -6px 14px rgba(255,255,255,0.05), inset 3px 3px 6px rgba(255,255,255,0.05), inset -5px -5px 10px rgba(0,0,0,0.5)',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  subtle: {
    backgroundColor: '#232019',
    boxShadow:
      '5px 6px 14px rgba(0,0,0,0.5), -4px -4px 10px rgba(255,255,255,0.04), inset 2px 2px 4px rgba(255,255,255,0.04), inset -3px -3px 7px rgba(0,0,0,0.45)',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 9,
    elevation: 5,
  },
  inset: {
    backgroundColor: '#1B1813',
    boxShadow:
      'inset 5px 5px 10px rgba(0,0,0,0.6), inset -5px -5px 10px rgba(255,255,255,0.04)',
  },
  greenRaised: {
    backgroundColor: '#273327',
    boxShadow:
      '8px 10px 22px rgba(0,0,0,0.6), -5px -5px 12px rgba(121,169,140,0.1), inset 3px 3px 6px rgba(121,169,140,0.1), inset -5px -5px 10px rgba(0,0,0,0.5)',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 9,
  },
  greenSubtle: {
    backgroundColor: '#273327',
    boxShadow:
      '5px 6px 14px rgba(0,0,0,0.55), -4px -4px 10px rgba(121,169,140,0.08), inset 2px 2px 4px rgba(121,169,140,0.08), inset -3px -3px 7px rgba(0,0,0,0.45)',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 9,
    elevation: 6,
  },
  greenInset: {
    backgroundColor: '#202B21',
    boxShadow:
      'inset 5px 5px 10px rgba(0,0,0,0.6), inset -5px -5px 10px rgba(121,169,140,0.1)',
  },
}

// ---------------------------------------------------------------------------
// Minimal — flat surfaces with a hairline border, no shadow. The calmest finish.
// ---------------------------------------------------------------------------

const lightMinimal: NeuRecipes = {
  raised: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(26,46,34,0.10)', elevation: 0 },
  subtle: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(26,46,34,0.07)', elevation: 0 },
  inset: { backgroundColor: '#F2EFEA', borderWidth: 1, borderColor: 'rgba(26,46,34,0.08)' },
  greenRaised: { backgroundColor: '#2E3D2F', elevation: 0 },
  greenSubtle: { backgroundColor: '#2E3D2F', elevation: 0 },
  greenInset: { backgroundColor: '#26331F' },
}

const darkMinimal: NeuRecipes = {
  raised: { backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', elevation: 0 },
  subtle: { backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', elevation: 0 },
  inset: { backgroundColor: '#171717', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  greenRaised: { backgroundColor: '#243026', elevation: 0 },
  greenSubtle: { backgroundColor: '#243026', elevation: 0 },
  greenInset: { backgroundColor: '#1F2A20' },
}

// ---------------------------------------------------------------------------
// Glassmorphism — translucent frosted panels with a light border. These recipes
// are the base look everywhere; primary surfaces additionally wrap a real
// backdrop blur (see {@link getGlass} + the GlassSurface component), which the
// translucent fill alone can't reproduce.
// ---------------------------------------------------------------------------

const lightGlass: NeuRecipes = {
  raised: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    boxShadow: '0px 8px 24px rgba(72,62,43,0.12)',
    shadowColor: '#493F30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  subtle: {
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    boxShadow: '0px 4px 14px rgba(72,62,43,0.1)',
    shadowColor: '#493F30',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  inset: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  greenRaised: {
    backgroundColor: 'rgba(46,61,47,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    boxShadow: '0px 8px 24px rgba(0,0,0,0.28)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  greenSubtle: {
    // Kept dark enough that white/cream text on a plain-View glass surface (not
    // routed through a real BlurView) still clears WCAG AA contrast.
    backgroundColor: 'rgba(46,61,47,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  greenInset: {
    backgroundColor: 'rgba(46,61,47,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
}

const darkGlass: NeuRecipes = {
  raised: {
    backgroundColor: 'rgba(40,40,40,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    boxShadow: '0px 8px 24px rgba(0,0,0,0.5)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 4,
  },
  subtle: {
    backgroundColor: 'rgba(40,40,40,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    boxShadow: '0px 4px 14px rgba(0,0,0,0.45)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 2,
  },
  inset: {
    backgroundColor: 'rgba(30,30,30,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  greenRaised: {
    backgroundColor: 'rgba(36,48,38,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    boxShadow: '0px 8px 24px rgba(0,0,0,0.55)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 5,
  },
  greenSubtle: {
    backgroundColor: 'rgba(36,48,38,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  greenInset: {
    backgroundColor: 'rgba(36,48,38,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
}

// ---------------------------------------------------------------------------
// Skins
// ---------------------------------------------------------------------------

export type Skin = 'neumorphism' | 'claymorphism' | 'glassmorphism' | 'minimal'

export const SKINS: { value: Skin; label: string; icon: string }[] = [
  { value: 'neumorphism', label: 'Neumorphic', icon: 'gesture-tap-button' },
  { value: 'claymorphism', label: 'Clay', icon: 'blur' },
  { value: 'glassmorphism', label: 'Glass', icon: 'card-outline' },
  { value: 'minimal', label: 'Minimal', icon: 'square-outline' },
]

const NEU_TABLE: Record<Skin, { light: NeuRecipes; dark: NeuRecipes }> = {
  neumorphism: { light: lightNeu, dark: darkNeu },
  claymorphism: { light: lightClay, dark: darkClay },
  glassmorphism: { light: lightGlass, dark: darkGlass },
  minimal: { light: lightMinimal, dark: darkMinimal },
}

// Zeroed legacy shadow props. Inset recipes are frequently composed on top of a
// raised/subtle base in a style array (e.g. `[styles.option, active && inset]`);
// since RN's flattenStyle only overrides keys that appear in the later object, an
// inset recipe that omits the legacy shadow*/elevation keys lets the base's
// outward shadow leak under the pressed-in look. Spreading these zeros first
// guarantees the inset variant clears them.
const NO_SHADOW = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
} as const

function resetInsetShadows(r: NeuRecipes): NeuRecipes {
  return {
    ...r,
    inset: { ...NO_SHADOW, ...r.inset },
    greenInset: { ...NO_SHADOW, ...r.greenInset },
  }
}

export function getNeu(scheme: ColorScheme, skin: Skin = 'neumorphism'): NeuRecipes {
  const table = NEU_TABLE[skin] ?? NEU_TABLE.neumorphism
  return resetInsetShadows(scheme === 'dark' ? table.dark : table.light)
}

/**
 * Config for the real backdrop-blur surfaces used by the glass skin. `tint`
 * feeds react-native's BlurView; `overlay`/`border` layer a translucent wash and
 * hairline on top so text stays legible over whatever shows through.
 */
export interface GlassConfig {
  intensity: number
  tint: 'light' | 'dark'
  overlay: string
  border: string
}

export function getGlass(scheme: ColorScheme): GlassConfig {
  return scheme === 'dark'
    ? { intensity: 40, tint: 'dark', overlay: 'rgba(30,30,30,0.35)', border: 'rgba(255,255,255,0.14)' }
    : { intensity: 40, tint: 'light', overlay: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.6)' }
}

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

const lightTheme: MD3Theme = {
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
    surfaceVariant: lightPalette.surface,
    onSurfaceVariant: lightPalette.textSecondary,
    onPrimary: '#FFFFFF',
    onSecondary: '#212121',
    onBackground: lightPalette.text,
    onSurface: lightPalette.text,
  },
}

const darkTheme: MD3Theme = {
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
    surfaceVariant: darkPalette.surface,
    onSurfaceVariant: darkPalette.textSecondary,
    onPrimary: darkPalette.onPrimary,
    onSecondary: '#212121',
    onBackground: darkPalette.text,
    onSurface: darkPalette.text,
  },
}

export function getPaperTheme(scheme: ColorScheme): MD3Theme {
  return scheme === 'dark' ? darkTheme : lightTheme
}
