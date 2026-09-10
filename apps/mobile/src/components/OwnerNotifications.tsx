import { View } from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { useNotifications } from '@/context/NotificationContext'
import { usePalette } from '@/context/ColorModeContext'
import { Button, Skeleton } from './Loading'
import { EmptyState } from './EmptyState'
import { GlassSurface } from './GlassSurface'
export function OwnerNotifications({ showTitle = true }: { showTitle?: boolean }) {
  const { items, error, loading, refresh, markRead } = useNotifications()
  const palette = usePalette()
  return (
    <View style={{ padding: 16, gap: 16 }}>
      {showTitle && (
        <Text variant="titleLarge" style={{ fontFamily: 'Outfit_700Bold' }}>
          Notifications
        </Text>
      )}
      {loading ? (
        <View accessibilityLabel="Loading notifications" style={{ gap: 12 }}>
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-off-outline"
          variant="error"
          title="Notifications couldn’t load"
          subtitle={error}
          ctaLabel="Retry"
          onCtaPress={refresh}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bell-check-outline"
          title="You’re all caught up"
          subtitle="Donation updates and payout news will appear here."
        />
      ) : (
        items.map((n) => (
          <GlassSurface key={n.id} style={{ padding: 20, borderRadius: 18, overflow: 'hidden' }}>
            <View
              pointerEvents="none"
              accessible={false}
              style={{ position: 'absolute', right: -12, top: -8, opacity: 0.05 }}
            >
              <Icon source="bell-outline" size={100} color={palette.primary} />
            </View>
            <Text variant="titleMedium">
              {n.title}
              {n.read ? '' : ' · New'}
            </Text>
            <Text style={{ marginTop: 8, color: palette.textSecondary }}>{n.message}</Text>
            {!n.read && (
              <Button
                onPress={() => void markRead(n.id)}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              >
                Mark as read
              </Button>
            )}
          </GlassSurface>
        ))
      )}
    </View>
  )
}
