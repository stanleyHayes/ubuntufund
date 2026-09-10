import { useState } from 'react'
import { Modal, ScrollView, View } from 'react-native'
import { IconButton, Text, Badge } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'
import { usePalette } from '@/context/ColorModeContext'
import { GlassSurface } from './GlassSurface'
import { OwnerNotifications } from './OwnerNotifications'
export function NotificationBell() {
  const { user } = useAuth()
  const { items, refresh } = useNotifications()
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const unread = items.filter((n) => !n.read).length
  if (!user) return null
  return (
    <>
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 16,
          backgroundColor: palette.background,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontFamily: 'Outfit_700Bold', color: palette.text }}>Ujimora</Text>
        <View>
          <IconButton
            icon="bell-outline"
            iconColor={palette.primary}
            accessibilityLabel={`Notifications, ${unread} unread`}
            onPress={() => {
              refresh()
              setOpen(true)
            }}
          />
          {unread > 0 && (
            <Badge
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 3,
                right: 3,
                backgroundColor: palette.secondary,
                color: palette.onPrimary,
              }}
            >
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </View>
      </View>
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        presentationStyle="pageSheet"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: palette.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <GlassSurface style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text variant="headlineSmall" style={{ fontFamily: 'Outfit_700Bold' }}>
                Notifications
              </Text>
              <IconButton
                icon="close"
                accessibilityLabel="Close notifications"
                onPress={() => setOpen(false)}
              />
            </View>
          </GlassSurface>
          <ScrollView>
            <OwnerNotifications showTitle={false} />
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
