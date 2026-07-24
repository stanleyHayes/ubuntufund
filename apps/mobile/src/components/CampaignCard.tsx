import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Text, Chip } from 'react-native-paper'
import { router } from 'expo-router'
import type { Campaign } from '@ubuntu-fund/types'
import { ProgressBar } from './ProgressBar'
import { brandColors } from '../theme'

interface CampaignCardProps {
  campaign: Campaign
}

const priorityColor: Record<string, string> = {
  critical: brandColors.error,
  urgent: brandColors.secondaryDark,
  normal: 'transparent',
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const progress = campaign.goalAmount > 0 ? campaign.raisedAmount / campaign.goalAmount : 0
  const [now] = useState(() => Date.now())
  const daysLeft = useMemo(() => {
    return Math.max(
      0,
      Math.ceil((new Date(campaign.endDate).getTime() - now) / (1000 * 60 * 60 * 24))
    )
  }, [campaign.endDate, now])

  return (
    <Card
      mode="contained"
      style={styles.card}
      onPress={() => router.push(`/campaign/${campaign.id}`)}
    >
      {campaign.imageUrls[0] && (
        <Card.Cover source={{ uri: campaign.imageUrls[0] }} style={styles.cover} />
      )}
      <Card.Content style={styles.content}>
        <View style={styles.chipRow}>
          <Chip compact style={styles.categoryChip} textStyle={styles.categoryChipText}>
            {campaign.category}
          </Chip>
          {campaign.priority !== 'normal' && (
            <Chip
              compact
              style={[styles.priorityChip, { backgroundColor: priorityColor[campaign.priority] }]}
              textStyle={styles.priorityChipText}
            >
              {campaign.priority}
            </Chip>
          )}
        </View>

        <Text variant="titleMedium" numberOfLines={2} style={styles.title}>
          {campaign.title}
        </Text>

        <Text variant="bodySmall" numberOfLines={2} style={styles.description}>
          {campaign.description}
        </Text>

        <ProgressBar progress={progress} />

        <View style={styles.stats}>
          <Text variant="bodySmall" style={styles.raised}>
            GH₵ {campaign.raisedAmount.toLocaleString()}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            of GH₵ {campaign.goalAmount.toLocaleString()}
          </Text>
          <Text variant="bodySmall" style={styles.daysLeft}>
            {daysLeft}d left
          </Text>
        </View>
      </Card.Content>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    overflow: 'hidden',
  },
  cover: { height: 160 },
  content: { padding: 12, paddingTop: 10 },
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  categoryChip: { height: 24, backgroundColor: 'rgba(168,181,160,0.28)' },
  categoryChipText: { fontSize: 11, fontFamily: 'TTSquares-Bold', color: brandColors.text },
  priorityChip: { height: 24 },
  priorityChipText: { fontSize: 11, fontFamily: 'TTSquares-Bold', color: '#FFFFFF' },
  title: { fontFamily: 'TTSquares-Bold', color: brandColors.text, marginBottom: 4 },
  description: { color: brandColors.textSecondary, marginBottom: 10, lineHeight: 18 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  raised: { color: brandColors.primary, fontFamily: 'TTSquares-Bold' },
  muted: { color: brandColors.textSecondary, flex: 1 },
  daysLeft: { color: brandColors.textSecondary },
})
