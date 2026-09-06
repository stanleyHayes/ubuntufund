import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Text, Chip } from 'react-native-paper'
import { router } from 'expo-router'
import type { Campaign } from '@ubuntu-fund/types'
import { ProgressBar } from './ProgressBar'
import { RemoteImage } from './RemoteImage'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

interface CampaignCardProps {
  campaign: Campaign
}

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    card: {
      ...neu.raised,
      marginBottom: 16,
      borderRadius: 14,
    },
    cover: { width: '100%', height: 160, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
    content: { padding: 12, paddingTop: 10 },
    chipRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
    categoryChip: { height: 24, backgroundColor: 'rgba(168,181,160,0.28)' },
    categoryChipText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: p.text },
    priorityChip: { height: 24 },
    priorityChipText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#FFFFFF' },
    title: { fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 4 },
    description: { color: p.textSecondary, marginBottom: 10, lineHeight: 18 },
    stats: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
    raised: { color: p.primary, fontFamily: 'Outfit_700Bold' },
    muted: { color: p.textSecondary, flex: 1 },
    daysLeft: { color: p.textSecondary },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const p = usePalette()
  const styles = useStyles()
  const priorityColor: Record<string, string> = {
    critical: p.error,
    urgent: p.secondaryDark,
    normal: 'transparent',
  }
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
      <RemoteImage uri={campaign.imageUrls[0]} style={styles.cover} />
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
