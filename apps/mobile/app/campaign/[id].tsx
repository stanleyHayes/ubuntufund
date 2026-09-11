import { Chip } from '@/components/Chip'
import { SkeletonLoader, Button } from '@/components/Loading'
import { useState, useEffect, useMemo } from 'react'
import { View, ScrollView, StyleSheet, Alert } from 'react-native'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { Text, Surface, Avatar, Icon } from 'react-native-paper'
import { useCampaign, useUser } from '@/hooks/useCampaigns'
import { RemoteImage } from '@/components/RemoteImage'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { ProgressBar } from '@/components/ProgressBar'
import { TrustBadge } from '@/components/TrustBadge'
import { shareCampaign } from '@/components/ShareCampaign'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import type { CampaignDonation } from '@ubuntu-fund/types'
import { CollaboratorRole, type CampaignCollaborator } from '@ubuntu-fund/types'
import { CampaignUpdatesList } from '@/components/CampaignUpdatesList'
import { CampaignComments } from '@/components/CampaignComments'

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  [CollaboratorRole.CO_OWNER]: 'Co-Owner',
  [CollaboratorRole.EDITOR]: 'Editor',
  [CollaboratorRole.FEATURED_PARTNER]: 'Featured Partner',
}

// Priority tag colors, built from the active palette so a mode switch recolors them.
function makePriorityStyle(p: Palette): Record<string, { bg: string; text: string }> {
  return {
    critical: { bg: `${p.error}24`, text: p.error },
    urgent: { bg: `${p.warning}29`, text: p.warningText },
    normal: { bg: 'rgba(168,181,160,0.28)', text: p.text },
  }
}

// Guarded date formatter — an absent or unparseable date renders "—", never "Invalid Date".
function formatDate(date?: string | Date | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

// Shared style factory — built from the active palette so a mode switch recolors
// everything. The screen calls `useStyles()` (below) to get the memoized result.
function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heroImage: { width: '100%', height: 240 },
    content: { padding: 16 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: { minHeight: 32, borderRadius: 10, justifyContent: 'center', backgroundColor: 'rgba(168,181,160,0.28)' },
    chipText: { fontSize: 12, lineHeight: 18, marginVertical: 6, fontFamily: 'Outfit_600SemiBold', color: p.text },
    title: { fontFamily: 'Outfit_700Bold', marginBottom: 16 },
    progressCard: {
      ...neu.raised,
      padding: 16,
      borderRadius: 14,
      marginBottom: 16,
      backgroundColor: p.surface,
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    raised: { color: p.success, fontFamily: 'Outfit_700Bold' },
    muted: { color: p.textSecondary },
    statRight: { alignItems: 'flex-end' },
    donateButton: { flex: 1, borderRadius: 28, overflow: 'hidden' },
    donateLabel: { fontSize: 16, fontFamily: 'Outfit_700Bold' },
    sectionTitle: { fontFamily: 'Outfit_700Bold', marginBottom: 8, marginTop: 8 },
    description: { lineHeight: 22, color: p.textSecondary, marginBottom: 16 },
    collaboratorAvatarRow: { flexDirection: 'row', gap: 4, marginBottom: 12 },
    collaboratorAvatar: { backgroundColor: p.primaryLight },
    collaboratorCard: {
      ...neu.raised,
      padding: 12,
      borderRadius: 14,
      marginBottom: 8,
      backgroundColor: p.surface,
    },
    collaboratorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    collaboratorInfo: { flex: 1 },
    collaboratorName: { fontFamily: 'Outfit_700Bold' },
    stillNeeded: { color: p.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: 20, fontFamily: 'Outfit_400Regular' },
    datesCard: {
      ...neu.raised,
      padding: 14,
      borderRadius: 14,
      marginBottom: 16,
      backgroundColor: p.surface,
    },
    dateRow: { flexDirection: 'row', justifyContent: 'space-around' },
    dateItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dateText: { fontFamily: 'Outfit_700Bold', color: p.text },
    creatorCard: {
      ...neu.raised,
      padding: 14,
      borderRadius: 14,
      marginBottom: 16,
      backgroundColor: p.surface,
    },
    creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    creatorInfo: { flex: 1 },
    creatorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    donationCard: {
      ...neu.raised,
      padding: 12,
      borderRadius: 14,
      marginBottom: 8,
      backgroundColor: p.surface,
    },
    donationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    donationInfo: { flex: 1 },
    donationAmount: { alignItems: 'flex-end' },
    paymentMethodsCard: {
      ...neu.raised,
      padding: 14,
      borderRadius: 14,
      marginBottom: 16,
      backgroundColor: p.surface,
    },
    paymentMethodItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    reportButton: { alignSelf: 'flex-end', marginTop: 4 },
    reportLabel: { fontSize: 13, fontFamily: 'Outfit_700Bold' },

    // Donation modal
    modalOverlay: {
      flex: 1,
      backgroundColor: p.overlay,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: p.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 36,
    },
    modalTitle: { fontFamily: 'Outfit_700Bold', marginBottom: 4 },
    fieldLabel: { fontFamily: 'Outfit_700Bold', marginBottom: 6, marginTop: 4 },
    modalInput: {
      ...neu.inset,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontFamily: 'Outfit_400Regular',
      marginBottom: 12,
      color: p.text,
    },
    paymentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    paymentOption: {
      ...neu.subtle,
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
    },
    paymentOptionActive: {
      borderColor: p.primary,
      backgroundColor: `${p.primary}14`,
    },
    paymentOptionText: { fontSize: 12, color: p.textSecondary, fontFamily: 'Outfit_700Bold' },
    paymentOptionTextActive: { color: p.primary },
    providerList: { gap: 8, marginBottom: 12 },
    providerOption: {
      ...neu.subtle,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: p.surface,
    },
    providerOptionActive: {
      borderColor: p.primary,
      backgroundColor: `${p.primary}14`,
    },
    providerOptionText: { fontSize: 13, color: p.textSecondary, fontFamily: 'Outfit_700Bold' },
    providerOptionTextActive: { color: p.primary },
    paymentFallback: {
      ...neu.inset,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: p.surface,
      marginBottom: 12,
    },
    paymentFallbackText: { flex: 1, fontSize: 13, color: p.textSecondary, fontFamily: 'Outfit_400Regular' },
    modalActions: { flexDirection: 'row', marginTop: 8 },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    shareButton: { flex: 1, borderRadius: 28, overflow: 'hidden' },
    actionContent: { minHeight: 48 },
    shareLabel: { fontSize: 16, fontFamily: 'Outfit_700Bold' },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user: signedInUser } = useAuth()
  const [activeLive, setActiveLive] = useState<{ id: string } | null>(null)
  useEffect(() => { let active = true; const load = () => api.get<{ id: string } | null>(`/campaigns/${id}/active-live`).then(value => { if (active) setActiveLive(value) }).catch(() => {}); void load(); const timer = setInterval(load, 15000); return () => { active = false; clearInterval(timer) } }, [id])
  const { campaign, isLoading, error, donationError } = useCampaign(id ?? '')
  const { user: creator } = useUser(campaign?.creatorId ?? '')

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const p = usePalette()
  const styles = useStyles()
  const priorityStyle = useMemo(() => makePriorityStyle(p), [p])

  // Collaborators state
  const [collaborators, setCollaborators] = useState<CampaignCollaborator[]>([])
  const [collabLoading, setCollabLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api
      .get<CampaignCollaborator[] | { items: CampaignCollaborator[] }>(`/campaigns/${id}/collaborators`)
      .then((data) => {
        if (!cancelled) {
          setCollaborators(Array.isArray(data) ? data : data.items ?? [])
        }
      })
      .catch(() => {
        // No collaborators or endpoint unavailable — show empty
        if (!cancelled) setCollaborators([])
      })
      .finally(() => {
        if (!cancelled) setCollabLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  if (isLoading) {
    return (
      <View style={styles.center}>
        <SkeletonLoader size="large" color={p.primary} />
      </View>
    )
  }

  if (error || !campaign) {
    return (
      <View style={styles.center}>
        <Text variant="bodyLarge">{error ?? 'Campaign not found'}</Text>
      </View>
    )
  }

  const progress = campaign.goalAmount > 0 ? campaign.raisedAmount / campaign.goalAmount : 0
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(campaign.endDate).getTime() - now) / (1000 * 60 * 60 * 24))
  )

  return (
    <>
      <Stack.Screen options={{ title: campaign.title }} />
      {activeLive && <Button mode="contained" icon="video" onPress={() => router.push(`/live/${activeLive.id}`)}>Watch live broadcast</Button>}
      {signedInUser?.id === campaign.creatorId && <Button icon="cog" onPress={() => router.push({ pathname: '/campaign/manage', params: { id } })}>Manage campaign</Button>}
      {signedInUser?.id === campaign.creatorId && <Button icon="video-plus" onPress={() => router.push({ pathname: '/campaign/live', params: { id } })}>Go live</Button>}
      <ScrollView style={styles.container}>
        <RemoteImage uri={campaign.imageUrls[0]} style={styles.heroImage} />

        <FadeInUp style={styles.content}>
          <View style={styles.chipRow}>
            <Chip style={styles.chip} textStyle={styles.chipText}>
              {campaign.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Chip>
            <Chip
              style={[
                styles.chip,
                { backgroundColor: (priorityStyle[campaign.priority] ?? priorityStyle.normal).bg },
              ]}
              textStyle={[
                styles.chipText,
                { color: (priorityStyle[campaign.priority] ?? priorityStyle.normal).text },
              ]}
            >
              {campaign.priority.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Chip>
            <Chip style={styles.chip} textStyle={styles.chipText}>
              {campaign.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Chip>
          </View>

          <Text variant="headlineSmall" style={styles.title}>
            {campaign.title}
          </Text>

          <Surface style={styles.progressCard} elevation={0}>
            <ProgressBar progress={progress} />
            <View style={styles.statsRow}>
              <View>
                <Text variant="titleMedium" style={styles.raised}>
                  GH₵ {campaign.raisedAmount.toLocaleString()}
                </Text>
                <Text variant="bodySmall" style={styles.muted}>
                  raised of GH₵ {campaign.goalAmount.toLocaleString()}
                </Text>
              </View>
              <View style={styles.statRight}>
                <Text variant="titleMedium">{Math.round(progress * 100)}%</Text>
                <Text variant="bodySmall" style={styles.muted}>funded</Text>
              </View>
              <View style={styles.statRight}>
                <Text variant="titleMedium">{daysLeft}</Text>
                <Text variant="bodySmall" style={styles.muted}>days left</Text>
              </View>
            </View>
          </Surface>

          <View style={styles.actionRow}>
            <Button
              mode="contained"
              style={styles.donateButton}
              contentStyle={styles.actionContent}
              labelStyle={styles.donateLabel}
              buttonColor={p.secondary}
              textColor="#221B0E"
              onPress={() => router.push(`/donate/${id}`)}
            >
              Donate Now
            </Button>
            <Button
              mode="contained"
              style={styles.shareButton}
              contentStyle={styles.actionContent}
              labelStyle={styles.shareLabel}
              buttonColor={p.primary}
              textColor={p.onPrimary}
              icon="share-variant"
              onPress={() => {
                if (campaign) shareCampaign(campaign)
              }}
            >
              Share
            </Button>
          </View>

          {campaign.goalAmount - campaign.raisedAmount > 0 && (
            <Text variant="bodySmall" style={styles.stillNeeded}>
              Still needed: GH₵ {(campaign.goalAmount - campaign.raisedAmount).toLocaleString()}
            </Text>
          )}

          {/* Updates */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Updates
          </Text>
          <CampaignUpdatesList campaignId={campaign.id} isCreator={false} />

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Comments
          </Text>
          <CampaignComments campaignId={campaign.id} creatorId={campaign.creatorId} />

          {/* About */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            About this campaign
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            {campaign.description}
          </Text>

          {/* Campaign Dates */}
          <Surface style={styles.datesCard} elevation={0}>
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Icon source="calendar-start" size={18} color={p.textSecondary} />
                <View>
                  <Text variant="labelSmall" style={styles.muted}>Started</Text>
                  <Text variant="bodySmall" style={styles.dateText}>
                    {formatDate(campaign.startDate)}
                  </Text>
                </View>
              </View>
              <View style={styles.dateItem}>
                <Icon source="calendar-end" size={18} color={p.textSecondary} />
                <View>
                  <Text variant="labelSmall" style={styles.muted}>Ends</Text>
                  <Text variant="bodySmall" style={styles.dateText}>
                    {formatDate(campaign.endDate)}
                  </Text>
                </View>
              </View>
            </View>
          </Surface>

          {/* Creator Info */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Campaign Creator
          </Text>
          <Surface style={styles.creatorCard} elevation={0}>
            <View style={styles.creatorRow}>
              <Avatar.Text
                size={48}
                label={(creator?.name ?? '?').charAt(0).toUpperCase()}
                style={{ backgroundColor: p.primary }}
              />
              <View style={styles.creatorInfo}>
                <View style={styles.creatorNameRow}>
                  <Text variant="bodyLarge" style={styles.collaboratorName}>
                    {creator?.name ?? 'Loading...'}
                  </Text>
                  {creator && creator.verificationLevel >= 2 && (
                    <Icon source="check-decagram" size={18} color={p.primary} />
                  )}
                </View>
                {creator?.country && (
                  <Text variant="bodySmall" style={styles.muted}>
                    {creator.country}
                  </Text>
                )}
              </View>
              {creator && (
                <TrustBadge level={creator.verificationLevel} trustScore={creator.trustScore} />
              )}
            </View>
          </Surface>

          {/* Recent Donations */}
          {donationError && <Text accessibilityRole="alert">{donationError}</Text>}
          {campaign.donations && campaign.donations.length > 0 && (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Recent Donations {campaign.donorCount > 0 && `(${campaign.donorCount})`}
              </Text>
              {campaign.donations.slice(0, 5).map((donation: CampaignDonation) => (
                <Surface key={donation.id} style={styles.donationCard} elevation={0}>
                  <View style={styles.donationRow}>
                    <Avatar.Text
                      size={36}
                      label={donation.isAnonymous ? '?' : donation.donorName.charAt(0).toUpperCase()}
                      style={{ backgroundColor: donation.isAnonymous ? '#9E9E9E' : p.primary }}
                    />
                    <View style={styles.donationInfo}>
                      <Text variant="bodyMedium" style={styles.collaboratorName}>
                        {donation.isAnonymous ? 'Anonymous' : donation.donorName}
                      </Text>
                      {donation.message && (
                        <Text variant="bodySmall" style={styles.muted} numberOfLines={2}>
                          {donation.message}
                        </Text>
                      )}
                    </View>
                    <View style={styles.donationAmount}>
                      <Text variant="bodyMedium" style={styles.raised}>
                        GH₵ {donation.amount.toLocaleString()}
                      </Text>
                      <Text variant="labelSmall" style={styles.muted}>
                        {formatDate(donation.createdAt)}
                      </Text>
                    </View>
                  </View>
                </Surface>
              ))}
            </>
          )}

          {/* Collaborators */}
          {collabLoading ? (
            <SkeletonLoader size="small" color={p.primary} style={{ marginVertical: 12 }} />
          ) : collaborators.length > 0 ? (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Collaborators
              </Text>
              {collaborators.map((c) => (
                <Surface key={c.id} style={styles.collaboratorCard} elevation={0}>
                  <View style={styles.collaboratorRow}>
                    <Avatar.Text
                      size={36}
                      label={(c.displayName ?? '?').charAt(0).toUpperCase()}
                      style={styles.collaboratorAvatar}
                    />
                    <View style={styles.collaboratorInfo}>
                      <Text variant="bodyMedium" style={styles.collaboratorName}>
                        {c.displayName}
                      </Text>
                      <Text variant="bodySmall" style={styles.muted}>
                        {ROLE_LABELS[c.role]} &middot; {c.revenueSharePercent}% share
                      </Text>
                    </View>
                  </View>
                </Surface>
              ))}
            </>
          ) : null}

          {/* Beneficiaries */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Beneficiaries
          </Text>
          <View style={styles.chipRow}>
            {campaign.beneficiaries.map((b) => (
              <Chip key={b} style={styles.chip} textStyle={styles.chipText}>
                {b}
              </Chip>
            ))}
          </View>

          {/* Payment Method */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Accepted Payment Method
          </Text>
          <Surface style={styles.paymentMethodsCard} elevation={0}>
            {[{ icon: 'wallet-outline', label: 'Ujimora Wallet' }].map((method) => (
              <View key={method.label} style={styles.paymentMethodItem}>
                <Icon source={method.icon} size={20} color={p.textSecondary} />
                <Text variant="bodySmall">{method.label}</Text>
              </View>
            ))}
          </Surface>

          {/* Report */}
          <Button
            mode="text"
            icon="flag-outline"
            textColor={p.error}
            style={styles.reportButton}
            labelStyle={styles.reportLabel}
            onPress={() => Alert.alert(
              'Report Campaign',
              'Are you sure you want to report this campaign for review?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Report', style: 'destructive', onPress: () => {
                  api.post(`/campaigns/${campaign.id}/report`, { reason: 'Flagged from mobile' })
                    .then(() => Alert.alert('Reported', 'Thank you. Our team will review this campaign.'))
                    .catch(() => Alert.alert('Error', 'Could not submit report. Please try again.'))
                }},
              ]
            )}
          >
            Report Campaign
          </Button>

          <View style={{ height: 32 }} />
        </FadeInUp>
      </ScrollView>


    </>
  )
}
