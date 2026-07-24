import { useState, useCallback, useEffect } from 'react'
import { View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
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
import * as Linking from 'expo-linking'
import { lightTheme } from '@/theme'
import { AuthProvider } from '@/context/AuthContext'
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

  const router = useRouter()

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url)
      if (!path) return

      const segments = path.split('/').filter(Boolean)
      if (segments.length < 2) return

      const [route, id] = segments
      if (route === 'campaigns' && id) {
        router.push(`/campaign/${id}`)
      } else if (route === 'donate' && id) {
        router.push(`/donate/${id}`)
      } else if (route === 'profile' && id) {
        router.push(`/profile/${id}`)
      }
    }

    const subscription = Linking.addEventListener('url', handleDeepLink)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url })
    })

    return () => {
      subscription.remove()
    }
  }, [router])

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
        <PaperProvider theme={lightTheme}>
          <AuthProvider>
            <StatusBar style="light" />
            {appReady && !splashDone && (
              <AppSplashScreen onFinish={() => setSplashDone(true)} />
            )}
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: lightTheme.colors.primary },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
                // Default push feel: the new screen slides in from the right.
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              {/* Auth screens cross-fade — no directional push. */}
              <Stack.Screen name="(auth)/login" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="(auth)/register" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
              <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
              <Stack.Screen name="campaign/[id]" options={{ title: 'Campaign' }} />
              {/* Modal-like flows rise up from the bottom. */}
              <Stack.Screen name="campaign/create" options={{ title: 'Start a Campaign', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="donate/[id]" options={{ title: 'Donate', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
              <Stack.Screen name="my-campaigns" options={{ title: 'My Campaigns' }} />
              <Stack.Screen name="my-donations" options={{ title: 'My Donations' }} />
              <Stack.Screen name="my-refunds" options={{ title: 'My Refunds' }} />
              <Stack.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
              <Stack.Screen name="invitations" options={{ title: 'Invitations' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="refund-request" options={{ title: 'Request Refund', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="organizations" options={{ title: 'Organizations' }} />
              <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </View>
  )
}
