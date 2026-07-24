import { View, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { Text, Avatar, ActivityIndicator, Surface, Chip } from 'react-native-paper'
import { useUser } from '@/hooks/useCampaigns'
import { TrustBadge } from '@/components/TrustBadge'
import { brandColors } from '@/theme'

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, isLoading } = useUser(id ?? '')

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    )
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text variant="bodyLarge">User not found</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: user.name ?? 'Profile' }} />
      <ScrollView style={styles.container}>
        <Surface style={styles.card} elevation={1}>
          <View style={styles.header}>
            <Avatar.Text
              size={80}
              label={(user.name ?? '?').charAt(0).toUpperCase()}
              style={{ backgroundColor: brandColors.primary }}
            />
            <View style={styles.headerInfo}>
              <Text variant="headlineSmall" style={{ fontFamily: 'Outfit_700Bold' }}>
                {user.name}
              </Text>
              {user.country && (
                <Text variant="bodyMedium" style={styles.muted}>
                  {user.country}
                </Text>
              )}
              <View style={{ marginTop: 8 }}>
                <TrustBadge level={user.verificationLevel} trustScore={user.trustScore} />
              </View>
            </View>
          </View>
        </Surface>

        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium" style={{ fontFamily: 'Outfit_700Bold', marginBottom: 12 }}>
            Details
          </Text>
          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={styles.muted}>Role</Text>
            <Chip style={styles.chip}>{user.role}</Chip>
          </View>
          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={styles.muted}>Verification</Text>
            <Chip style={styles.chip}>Level {user.verificationLevel}</Chip>
          </View>
          {user.role === 'organization' && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.muted}>Organization</Text>
              <Text variant="bodyMedium" style={{ fontFamily: 'Outfit_700Bold' }}>
                Verified Organization
              </Text>
            </View>
          )}
        </Surface>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerInfo: {
    flex: 1,
  },
  muted: { color: '#757575' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chip: { height: 28 },
})
