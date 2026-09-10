import { Pressable } from '@/components/RoundedControls'
import { View } from 'react-native'
import { Tabs, router } from 'expo-router'
import { Icon, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { usePalette } from '@/context/ColorModeContext'
import { GlassSurface } from '@/components/GlassSurface'

const items: Record<string, { icon: string; label: string }> = {
  index: { icon: 'home-outline', label: 'Home' },
  explore: { icon: 'compass-outline', label: 'Explore' },
  create: { icon: 'plus', label: 'Start' },
  dashboard: { icon: 'view-dashboard-outline', label: 'Dashboard' },
  profile: { icon: 'account-outline', label: 'Profile' },
}
function TabBar({ state, navigation }: BottomTabBarProps) {
  const p = usePalette(); const insets = useSafeAreaInsets()
  return <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: p.background }}>
    <GlassSurface style={{ borderRadius: 36, paddingHorizontal: 8, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>{['index', 'explore', 'create', 'dashboard', 'profile'].map(name => {
        const route = state.routes.find(r => r.name === name)!
        const active = state.routes[state.index].key === route.key
        const item = items[name]
        return <Pressable key={name} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }} style={{ flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 24 }} onPress={() => {
          if (name === 'create') { router.push('/campaign/create'); return }
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!event.defaultPrevented) navigation.navigate(name)
        }}>
          <View style={{ padding: 7, borderRadius: 22, backgroundColor: name === 'create' ? p.primary : active ? p.skeleton : 'transparent' }}><Icon source={item.icon} size={name === 'create' ? 26 : 22} color={name === 'create' ? p.onPrimary : active ? p.primary : p.textSecondary} /></View>
          <Text style={{ fontSize: 10, color: active ? p.primary : p.textSecondary, fontFamily: 'Outfit_700Bold' }}>{item.label}</Text>
        </Pressable>
      })}</View>
    </GlassSurface>
  </View>
}
export default function TabLayout() {
  const p = usePalette()
  return <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerStyle: { backgroundColor: p.background }, headerTintColor: p.text, headerTitleStyle: { fontFamily: 'Outfit_700Bold' } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false }} />
    <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
    <Tabs.Screen name="create" options={{ title: 'Start' }} />
    <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', headerShown: false }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', headerShown: false }} />
    <Tabs.Screen name="subscription" options={{ href: null, title: 'Plans' }} />
    <Tabs.Screen name="wallet" options={{ href: null, title: 'Wallet', headerShown: false }} />
  </Tabs>
}
