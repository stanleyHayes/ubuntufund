import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper'
import type { MD3Theme } from 'react-native-paper'

const brandColors = {
  primary: '#2E7D32',
  primaryLight: '#4CAF50',
  primaryDark: '#1B5E20',
  secondary: '#F9A825',
  secondaryLight: '#FDD835',
  secondaryDark: '#F57F17',
  error: '#D32F2F',
  success: '#2E7D32',
  warning: '#F9A825',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
}

// Configure all MD3 type scales to use TT Squares
const fontConfig = {
  displayLarge: { fontFamily: 'TTSquares-Black' },
  displayMedium: { fontFamily: 'TTSquares-Black' },
  displaySmall: { fontFamily: 'TTSquares-Bold' },
  headlineLarge: { fontFamily: 'TTSquares-Black' },
  headlineMedium: { fontFamily: 'TTSquares-Bold' },
  headlineSmall: { fontFamily: 'TTSquares-Bold' },
  titleLarge: { fontFamily: 'TTSquares-Bold' },
  titleMedium: { fontFamily: 'TTSquares-Bold' },
  titleSmall: { fontFamily: 'TTSquares-Bold' },
  labelLarge: { fontFamily: 'TTSquares-Bold' },
  labelMedium: { fontFamily: 'TTSquares-Bold' },
  labelSmall: { fontFamily: 'TTSquares-Bold' },
  bodyLarge: { fontFamily: 'TTSquares-Regular' },
  bodyMedium: { fontFamily: 'TTSquares-Regular' },
  bodySmall: { fontFamily: 'TTSquares-Regular' },
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
