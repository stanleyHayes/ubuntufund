import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Chip, Icon, Text } from 'react-native-paper'
import { Stack, useLocalSearchParams } from 'expo-router'
import type { Campaign, CampaignCategory } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { CampaignCard } from '@/components/CampaignCard'
import { EmptyState } from '@/components/EmptyState'
import { usePalette } from '@/context/ColorModeContext'
import type { Palette } from '@/theme'

interface OrganizationDetail {
  id: string
  name: string
  description: string
  country: string
  city: string
  verified: boolean
  website?: string
  founded: number
  impactStatement: string
  campaignCount: number
  totalRaised: number
  currency: string
  categories: CampaignCategory[]
}

export default function OrganizationProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const p = usePalette()
  const styles = useStyles()
  const [organization, setOrganization] = useState<OrganizationDetail | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const detail = await api.get<OrganizationDetail>(`/organizations/${id}`)
      const campaignList = await api.get<Campaign[]>(`/organizations/${detail.id}/campaigns`)
      setOrganization(detail)
      setCampaigns(Array.isArray(campaignList) ? campaignList : [])
    } catch (loadError) {
      setOrganization(null)
      setCampaigns([])
      setError(loadError instanceof Error ? loadError.message : 'Unable to load organization.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <View style={styles.center}><Stack.Screen options={{ title: 'Organization' }} /><ActivityIndicator size="large" /></View>
  }

  if (!organization) {
    return <View style={styles.center}><EmptyState variant="error" icon="office-building-remove-outline" title={error || 'Organization not found'} ctaLabel="Retry" onCtaPress={load} /></View>
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: organization.name }} />
      <View style={styles.hero}>
        <View style={styles.iconTile}><Icon source="office-building" size={30} color="#FFFFFF" /></View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{organization.name}</Text>
          {organization.verified && <Icon source="check-decagram" size={20} color={p.success} />}
        </View>
        <Text style={styles.meta}>{[organization.city, organization.country].filter(Boolean).join(', ') || 'Ghana'} · Founded {organization.founded}</Text>
        <Text style={styles.statement}>{organization.impactStatement}</Text>
        <View style={styles.stats}>
          <View><Text style={styles.statValue}>{organization.campaignCount}</Text><Text style={styles.statLabel}>Campaigns</Text></View>
          <View><Text style={styles.statValue}>{organization.currency} {organization.totalRaised.toLocaleString()}</Text><Text style={styles.statLabel}>Raised</Text></View>
        </View>
        {organization.categories.length > 0 && <View style={styles.chips}>{organization.categories.map((category) => <Chip key={category} compact>{category}</Chip>)}</View>}
      </View>

      <Text style={styles.sectionTitle}>Campaigns</Text>
      {campaigns.length === 0 ? (
        <EmptyState variant="default" icon="bullhorn-outline" title="No campaigns yet" />
      ) : campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
      {error && <Button onPress={load}>Retry</Button>}
    </ScrollView>
  )
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.background },
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.background, padding: 24 },
    hero: { backgroundColor: p.surface, borderRadius: 18, padding: 20, gap: 10 },
    iconTile: { width: 54, height: 54, borderRadius: 16, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { flex: 1, fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: p.text },
    meta: { fontFamily: 'Outfit_400Regular', color: p.textSecondary },
    statement: { fontFamily: 'Outfit_400Regular', color: p.text, lineHeight: 21 },
    stats: { flexDirection: 'row', gap: 28, paddingTop: 8 },
    statValue: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: p.primary },
    statLabel: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: p.textSecondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: p.text, marginTop: 6 },
  })
}

function useStyles() {
  const p = usePalette()
  return useMemo(() => makeStyles(p), [p])
}
