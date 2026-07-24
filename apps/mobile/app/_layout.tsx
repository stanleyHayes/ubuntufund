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
    'TTSquares-Light': require('../assets/fonts/Squares Light.otf'),
    'TTSquares-Regular': require('../assets/fonts/Squares Regular.otf'),
    'TTSquares-Bold': require('../assets/fonts/Squares Bold.otf'),
    'TTSquares-Black': require('../assets/fonts/Squares Black.otf'),
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
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
                headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
              <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
              <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
              <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
              <Stack.Screen name="campaign/[id]" options={{ title: 'Campaign' }} />
              <Stack.Screen name="campaign/create" options={{ title: 'Start a Campaign' }} />
              <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
              <Stack.Screen name="my-campaigns" options={{ title: 'My Campaigns' }} />
              <Stack.Screen name="my-donations" options={{ title: 'My Donations' }} />
              <Stack.Screen name="my-refunds" options={{ title: 'My Refunds' }} />
              <Stack.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
              <Stack.Screen name="invitations" options={{ title: 'Invitations' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="refund-request" options={{ title: 'Request Refund' }} />
              <Stack.Screen name="organizations" options={{ title: 'Organizations' }} />
              <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </View>
  )
}
