import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper'
import type { MD3Theme } from 'react-native-paper'
import type { ViewStyle } from 'react-native'

const brandColors = {
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
}

/**
 * Native material recipes. Light comes from the top-left across the app.
 * Actions and icon tiles rest raised; inputs and selected wells are inset.
 */
export const neumorphism = {
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
} satisfies Record<string, ViewStyle>

// Configure all MD3 type scales to use TT Squares
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
    primary: brandColors.primary,
    primaryContainer: brandColors.primaryLight,
    secondary: brandColors.secondary,
    secondaryContainer: brandColors.secondaryLight,
    error: brandColors.error,
    background: brandColors.background,
    surface: brandColors.surface,
    onPrimary: '#FFFFFF',
    onSecondary: '#212121',
    onBackground: brandColors.text,
    onSurface: brandColors.text,
  },
}

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: brandColors.primaryLight,
    primaryContainer: brandColors.primaryDark,
    secondary: brandColors.secondary,
    secondaryContainer: brandColors.secondaryDark,
    error: '#EF5350',
    background: '#121212',
    surface: '#1E1E1E',
    onPrimary: '#FFFFFF',
    onSecondary: '#212121',
    onBackground: '#E0E0E0',
    onSurface: '#E0E0E0',
  },
}

export { brandColors }
