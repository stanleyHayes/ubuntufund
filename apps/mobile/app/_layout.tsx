import { NotificationProvider } from '@/context/NotificationContext'
import { NotificationBell } from '@/components/NotificationBell'
import { useState, useCallback, useEffect } from 'react'
import { View } from 'react-native'
import { Stack, usePathname } from 'expo-router'
import { PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit'
import * as NativeSplash from 'expo-splash-screen'
import { AuthProvider } from '@/context/AuthContext'
import { ColorModeProvider, useColorMode } from '@/context/ColorModeContext'
import AppSplashScreen from '@/components/SplashScreen'
import { setupNotificationHandlers } from '@/services/notifications'

NativeSplash.preventAutoHideAsync()

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const cleanup = setupNotificationHandlers()
    return cleanup
  }, [])

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  })

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await NativeSplash.hideAsync()
      setAppReady(true)
    }
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ColorModeProvider>
          <ThemedApp
            appReady={appReady}
            splashDone={splashDone}
            onSplashFinish={() => setSplashDone(true)}
          />
        </ColorModeProvider>
      </SafeAreaProvider>
    </View>
  )
}

/**
 * The app shell, themed by the active color mode. Split out so it can read
 * {@link useColorMode} (which must sit under {@link ColorModeProvider}) and hand
 * the resolved Paper theme to `PaperProvider` — flipping the whole app between
 * light and dark from one preference.
 */
function ThemedApp({
  appReady,
  splashDone,
  onSplashFinish,
}: {
  appReady: boolean
  splashDone: boolean
  onSplashFinish: () => void
}) {
  const { paperTheme } = useColorMode()
  const pathname = usePathname()

  return (
    <PaperProvider theme={paperTheme}>
      <AuthProvider>
        <NotificationProvider>
          <NotificationBell />
          <StatusBar style={pathname === '/' || paperTheme.dark ? 'light' : 'dark'} />
          {appReady && !splashDone && <AppSplashScreen onFinish={onSplashFinish} />}
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: paperTheme.colors.background },
              headerTintColor: paperTheme.colors.onBackground,
              headerBackTitle: 'Back',
              headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
              // Default push feel: the new screen slides in from the right.
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: paperTheme.colors.background },
            }}
          >
            <Stack.Screen name="+not-found" options={{ title: 'Page not found' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Auth screens cross-fade — no directional push. */}
            <Stack.Screen name="(auth)/login" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen
              name="(auth)/register"
              options={{ headerShown: false, animation: 'fade' }}
            />
            <Stack.Screen
              name="forgot-password"
              options={{ headerShown: false, animation: 'fade' }}
            />
            <Stack.Screen name="legal" options={{ title: 'Legal & trust' }} />
            <Stack.Screen name="organizer-agreement" options={{ title: 'Organizer agreement' }} />
            <Stack.Screen name="contributor-terms" options={{ title: 'Contributor terms' }} />
            <Stack.Screen name="refund-policy" options={{ title: 'Payout & refund' }} />
            <Stack.Screen name="acceptable-use" options={{ title: 'Acceptable use' }} />
            <Stack.Screen name="cookies" options={{ title: 'Cookies' }} />
            <Stack.Screen name="billing-terms" options={{ title: 'Subscription & billing' }} />
            <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
            <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
            <Stack.Screen name="campaign/[id]" options={{ title: 'Campaign' }} />
            {/* Modal-like flows rise up from the bottom. */}
            <Stack.Screen
              name="campaign/create"
              options={{ title: 'Start a Campaign', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="donate/[id]"
              options={{ title: 'Donate', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
            <Stack.Screen name="my-campaigns" options={{ title: 'My Campaigns' }} />
            <Stack.Screen name="my-donations" options={{ title: 'My Donations' }} />
            <Stack.Screen name="my-refunds" options={{ title: 'My Refunds' }} />
            <Stack.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
            <Stack.Screen name="invitations" options={{ title: 'Invitations' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="affiliate" options={{ title: 'Affiliate' }} />
            <Stack.Screen
              name="refund-request"
              options={{ title: 'Request Refund', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="organizations" options={{ title: 'Organizations' }} />
            <Stack.Screen name="organization/[id]" options={{ title: 'Organization' }} />
            <Stack.Screen name="index" options={{ headerShown: false }} />
          </Stack>
        </NotificationProvider>
      </AuthProvider>
    </PaperProvider>
  )
}
