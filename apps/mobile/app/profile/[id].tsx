import { SkeletonLoader } from '@/components/Loading'
import { useMemo } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { Text, Avatar, Surface, Chip } from 'react-native-paper'
import { useUser } from '@/hooks/useCampaigns'
import { TrustBadge } from '@/components/TrustBadge'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, isLoading } = useUser(id ?? '')
  const p = usePalette()
  const styles = useStyles()

  if (isLoading) {
    return (
      <View style={styles.center}>
        <SkeletonLoader size="large" color={p.primary} />
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
        <Surface style={styles.card} elevation={0}>
          <View style={styles.header}>
            <Avatar.Text
              size={80}
              label={(user.name ?? '?').charAt(0).toUpperCase()}
              style={{ backgroundColor: p.primary }}
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

        <Surface style={styles.card} elevation={0}>
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

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: p.background },
    card: {
      ...neu.raised,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 14,
      backgroundColor: p.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    headerInfo: {
      flex: 1,
    },
    muted: { color: p.textSecondary },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    chip: { height: 28, backgroundColor: 'rgba(168,181,160,0.28)' },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}
