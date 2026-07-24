import { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { Text, Chip, ActivityIndicator, Avatar, Icon, Surface } from 'react-native-paper'
import type { CampaignUpdate } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { brandColors } from '@/theme'

const typeColors: Record<string, { text: string; bg: string }> = {
  milestone: { text: brandColors.secondaryDark, bg: 'rgba(199,162,74,0.18)' },
  general: { text: brandColors.text, bg: 'rgba(168,181,160,0.28)' },
  thank_you: { text: brandColors.success, bg: 'rgba(47,107,70,0.14)' },
  urgent: { text: brandColors.warning, bg: 'rgba(185,138,46,0.16)' },
}

interface CampaignUpdatesListProps {
  campaignId: string
  isCreator?: boolean
}

export function CampaignUpdatesList({ campaignId }: CampaignUpdatesListProps) {
  const [updates, setUpdates] = useState<CampaignUpdate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    api
      .get<{ items: CampaignUpdate[] }>(`/campaigns/${campaignId}/updates`)
      .then((data) => {
        if (!cancelled) {
          setUpdates(data.items ?? [])
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setUpdates([])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [campaignId])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={brandColors.primary} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: brandColors.error }}>{error}</Text>
      </View>
    )
  }

  if (updates.length === 0) {
    return (
      <EmptyState
        style={styles.updatesEmpty}
        icon="bell-outline"
        title="No updates yet"
        subtitle="Check back soon for news from the campaign creator."
      />
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {updates.map((update, i) => {
        const typeStyle = typeColors[update.type] ?? typeColors.general
        const isExpanded = expandedIds.has(update.id)
        const shouldTruncate = update.content.length > 200

        return (
          <FadeInUp key={update.id} index={i}>
          <Surface style={styles.card} elevation={0}>
            {update.isPinned && (
              <View style={styles.pinnedRow}>
                <Icon source="pin" size={14} color={brandColors.primary} />
                <Text style={styles.pinnedText}>Pinned</Text>
              </View>
            )}

            <View style={styles.headerRow}>
              <Avatar.Text
                size={32}
                label="U"
                style={{ backgroundColor: brandColors.primary }}
              />
              <View style={styles.headerInfo}>
                <Text style={styles.authorName}>Campaign Update</Text>
                <Text style={styles.dateText}>
                  {new Date(update.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Chip
                style={[styles.typeChip, { backgroundColor: typeStyle.bg }]}
                textStyle={{ color: typeStyle.text, fontSize: 11, fontFamily: 'Outfit_700Bold' }}
              >
                {update.type.replace(/_/g, ' ')}
              </Chip>
            </View>

            <Text style={styles.title}>{update.title}</Text>

            <Text style={styles.content} numberOfLines={isExpanded ? undefined : 4}>
              {update.content}
            </Text>

            {shouldTruncate && (
              <TouchableOpacity onPress={() => toggleExpand(update.id)}>
                <Text style={styles.readMore}>
                  {isExpanded ? 'Show less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            )}

            {update.mediaUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
                {update.mediaUrls.map((url, mi) => (
                  <RemoteImage key={mi} uri={url} style={styles.mediaImage} />
                ))}
              </ScrollView>
            )}
          </Surface>
          </FadeInUp>
        )
      })}
      <View style={{ height: 16 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  updatesEmpty: { paddingTop: 24, paddingBottom: 8 },
  emptyIconTile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168,181,160,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: brandColors.text,
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: 13,
    color: brandColors.textSecondary,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
  },
  list: { padding: 16 },
  card: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: brandColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  pinnedText: {
    fontSize: 12,
    color: brandColors.primary,
    fontFamily: 'Outfit_700Bold',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  headerInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: brandColors.text,
  },
  dateText: {
    fontSize: 11,
    color: brandColors.textSecondary,
    fontFamily: 'Outfit_400Regular',
  },
  typeChip: {
    height: 24,
    borderRadius: 6,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: brandColors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  content: {
    fontSize: 13,
    color: brandColors.textSecondary,
    lineHeight: 20,
    fontFamily: 'Outfit_400Regular',
  },
  readMore: {
    fontSize: 12,
    color: brandColors.primary,
    fontFamily: 'Outfit_700Bold',
    marginTop: 6,
    paddingVertical: 6,
  },
  mediaScroll: {
    marginTop: 10,
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
  },
})
