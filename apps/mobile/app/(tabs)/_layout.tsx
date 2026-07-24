import { View, Pressable, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { Icon, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { brandColors } from '@/theme'

const TAB_ITEMS: Record<string, { icon: string; iconActive: string; label: string }> = {
  index: { icon: 'home-variant-outline', iconActive: 'home-variant', label: 'Home' },
  explore: { icon: 'compass-outline', iconActive: 'compass', label: 'Explore' },
  subscription: { icon: 'crown-outline', iconActive: 'crown', label: 'Plans' },
  wallet: { icon: 'wallet-outline', iconActive: 'wallet', label: 'Wallet' },
  profile: { icon: 'account-outline', iconActive: 'account', label: 'Profile' },
}

/**
 * Floating pill tab bar: detached forest capsule on a parchment strip,
 * active item's icon sits in a soft cream capsule (WhatsApp-style).
 * Rendered in normal flow so screens keep their own scroll padding.
 */
function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes
          .filter((route) => TAB_ITEMS[route.name])
          .map((route) => {
            const focused = state.routes[state.index].key === route.key
            const item = TAB_ITEMS[route.name]
            return (
              <Pressable
                key={route.key}
                style={styles.item}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
                }}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={item.label}
              >
                <View style={[styles.iconCapsule, focused && styles.iconCapsuleActive]}>
                  <Icon
                    source={focused ? item.iconActive : item.icon}
                    size={22}
                    color={focused ? '#F5F2EA' : 'rgba(245,242,234,0.55)'}
                  />
                </View>
                <Text style={[styles.label, focused && styles.labelActive]}>{item.label}</Text>
              </Pressable>
            )
          })}
      </View>
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: brandColors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="subscription" options={{ title: 'Plans' }} />
      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet', headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', headerShown: false }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: brandColors.background,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: brandColors.primaryDark,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  iconCapsule: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 999,
  },
  iconCapsuleActive: {
    backgroundColor: 'rgba(245,242,234,0.12)',
  },
  label: {
    fontSize: 10,
    fontFamily: 'TTSquares-Bold',
    color: 'rgba(245,242,234,0.55)',
  },
  labelActive: {
    color: '#F5F2EA',
  },
})
