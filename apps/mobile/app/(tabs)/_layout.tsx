import { Tabs } from 'expo-router'
import { Icon } from 'react-native-paper'
import { brandColors } from '@/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: brandColors.primary,
        tabBarInactiveTintColor: brandColors.textSecondary,
        headerStyle: { backgroundColor: brandColors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        tabBarLabelStyle: { fontFamily: 'TTSquares-Bold', fontSize: 10 },
        tabBarStyle: {
          backgroundColor: brandColors.surface,
          borderTopWidth: 1,
          borderTopColor: 'rgba(26,46,34,0.10)',
          elevation: 0,
          shadowColor: 'transparent',
          shadowOpacity: 0,
          height: 56,
          paddingBottom: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Icon source="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => <Icon source="compass" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, size }) => (
            <Icon source="crown" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Icon source="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
