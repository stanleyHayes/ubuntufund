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
  critical: '#A5432F',
  urgent: '#A07E33',
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
      style={styles.card}
      onPress={() => router.push(`/campaign/${campaign.id}`)}
    >
      {campaign.imageUrls[0] && (
        <Card.Cover source={{ uri: campaign.imageUrls[0] }} style={styles.cover} />
      )}
      <Card.Content style={styles.content}>
        <View style={styles.chipRow}>
          <Chip compact style={styles.categoryChip} textStyle={styles.chipText}>
            {campaign.category}
          </Chip>
          {campaign.priority !== 'normal' && (
            <Chip
              compact
              style={[styles.priorityChip, { backgroundColor: priorityColor[campaign.priority] }]}
              textStyle={[styles.chipText, { color: '#FFFFFF' }]}
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
            {campaign.currency} {campaign.raisedAmount.toLocaleString()}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            of {campaign.currency} {campaign.goalAmount.toLocaleString()}
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
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  cover: { height: 160 },
  content: { padding: 12, paddingTop: 10 },
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  categoryChip: { height: 24 },
  priorityChip: { height: 24 },
  chipText: { fontSize: 11, fontFamily: 'TTSquares-Regular' },
  title: { fontFamily: 'TTSquares-Bold', marginBottom: 4 },
  description: { color: '#757575', marginBottom: 10, lineHeight: 18 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  raised: { color: brandColors.primary, fontFamily: 'TTSquares-Bold' },
  muted: { color: '#757575', flex: 1 },
  daysLeft: { color: '#757575' },
})
