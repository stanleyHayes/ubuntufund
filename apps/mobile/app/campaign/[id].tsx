import { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet, Image, Alert, Modal, TextInput, TouchableOpacity, Linking } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { Text, Button, Chip, ActivityIndicator, Surface, Avatar, Divider, Icon } from 'react-native-paper'
import { useCampaign, useUser } from '@/hooks/useCampaigns'
import { useEnabledPaymentProviders, EnabledPaymentProvider, getProviderIcon } from '@/hooks/useEnabledPaymentProviders'
import { ProgressBar } from '@/components/ProgressBar'
import { TrustBadge } from '@/components/TrustBadge'
import { shareCampaign } from '@/components/ShareCampaign'
import { brandColors } from '@/theme'
import { api } from '@/lib/api'
import type { CampaignPriority, CampaignDonation } from '@ubuntu-fund/types'
import { CollaboratorRole, CollaborationStatus, type CampaignCollaborator } from '@ubuntu-fund/types'
import { CampaignUpdatesList } from '@/components/CampaignUpdatesList'

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  [CollaboratorRole.CO_OWNER]: 'Co-Owner',
  [CollaboratorRole.EDITOR]: 'Editor',
  [CollaboratorRole.FEATURED_PARTNER]: 'Featured Partner',
}

const priorityStyle: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(165,67,47,0.14)', text: brandColors.error },
  urgent: { bg: 'rgba(185,138,46,0.16)', text: brandColors.warning },
  normal: { bg: 'rgba(168,181,160,0.28)', text: brandColors.text },
}

// Guarded date formatter — an absent or unparseable date renders "—", never "Invalid Date".
function formatDate(date?: string | Date | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { campaign, isLoading, error } = useCampaign(id ?? '')
  const { user: creator } = useUser(campaign?.creatorId ?? '')

  // Collaborators state
  const [collaborators, setCollaborators] = useState<CampaignCollaborator[]>([])
  const [collabLoading, setCollabLoading] = useState(true)

  // Donation modal state
  const [donateModalVisible, setDonateModalVisible] = useState(false)
  const [donateAmount, setDonateAmount] = useState('')
  const [donateMessage, setDonateMessage] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<EnabledPaymentProvider | null>(null)
  const [isDonating, setIsDonating] = useState(false)

  const { providers, isLoading: providersLoading, error: providersError } = useEnabledPaymentProviders()

  const fallbackWalletProvider: EnabledPaymentProvider = {
    id: 'fallback-wallet',
    name: 'Wallet',
    slug: 'wallet',
    type: 'wallet',
    isDefault: true,
    feePercent: 0,
  }

  useEffect(() => {
    if (selectedProvider) return
    if (providers.length > 0) {
      const defaultProvider = providers.find((p) => p.isDefault) ?? providers[0]
      setSelectedProvider(defaultProvider)
    } else if (providersError) {
      setSelectedProvider(fallbackWalletProvider)
    }
  }, [providers, providersError, selectedProvider])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setCollabLoading(true)
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

  const handleDonate = async () => {
    const amount = Number(donateAmount)
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid donation amount.')
      return
    }

    if (!selectedProvider) {
      Alert.alert('No Payment Method', 'Please select a payment method.')
      return
    }

    if (selectedProvider.type !== 'wallet') {
      Alert.alert('Coming Soon', 'This payment method will be available soon.')
      return
    }

    setIsDonating(true)
    try {
      await api.post(`/campaigns/${id}/donate`, {
        amount,
        currency: campaign?.currency ?? 'GHS',
        paymentMethod: selectedProvider.slug,
        message: donateMessage || undefined,
        isAnonymous: false,
      })
      setDonateModalVisible(false)
      setDonateAmount('')
      setDonateMessage('')
      setSelectedProvider(null)
      Alert.alert('Thank You!', 'Your donation was submitted successfully.')
    } catch (err: unknown) {
      Alert.alert('Donation Failed', err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsDonating(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandColors.primary} />
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
    Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  )

  return (
    <>
      <Stack.Screen options={{ title: campaign.title }} />
      <ScrollView style={styles.container}>
        {campaign.imageUrls[0] && (
          <Image source={{ uri: campaign.imageUrls[0] }} style={styles.heroImage} />
        )}

        <View style={styles.content}>
          <View style={styles.chipRow}>
            <Chip style={styles.chip} textStyle={styles.chipText}>
              {campaign.category}
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
              {campaign.priority}
            </Chip>
            <Chip style={styles.chip} textStyle={styles.chipText}>
              {campaign.status.replace(/_/g, ' ').toUpperCase()}
            </Chip>
          </View>

          <Text variant="headlineSmall" style={styles.title}>
            {campaign.title}
          </Text>

          <Surface style={styles.progressCard} elevation={1}>
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
              labelStyle={styles.donateLabel}
              buttonColor={brandColors.secondary}
              textColor="#221B0E"
              onPress={() => setDonateModalVisible(true)}
            >
              Donate Now
            </Button>
            <Button
              mode="contained"
              style={styles.shareButton}
              labelStyle={styles.shareLabel}
              buttonColor={brandColors.primary}
              textColor="#FFFFFF"
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

          {/* About */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            About this campaign
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            {campaign.description}
          </Text>

          {/* Campaign Dates */}
          <Surface style={styles.datesCard} elevation={1}>
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Icon source="calendar-start" size={18} color={brandColors.textSecondary} />
                <View>
                  <Text variant="labelSmall" style={styles.muted}>Started</Text>
                  <Text variant="bodySmall" style={styles.dateText}>
                    {formatDate(campaign.startDate)}
                  </Text>
                </View>
              </View>
              <View style={styles.dateItem}>
                <Icon source="calendar-end" size={18} color={brandColors.textSecondary} />
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
          <Surface style={styles.creatorCard} elevation={1}>
            <View style={styles.creatorRow}>
              <Avatar.Text
                size={48}
                label={(creator?.name ?? '?').charAt(0).toUpperCase()}
                style={{ backgroundColor: brandColors.primary }}
              />
              <View style={styles.creatorInfo}>
                <View style={styles.creatorNameRow}>
                  <Text variant="bodyLarge" style={styles.collaboratorName}>
                    {creator?.name ?? 'Loading...'}
                  </Text>
                  {creator && creator.verificationLevel >= 2 && (
                    <Icon source="check-decagram" size={18} color={brandColors.primary} />
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
          {campaign.donations && campaign.donations.length > 0 && (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Recent Donations {campaign.donorCount > 0 && `(${campaign.donorCount})`}
              </Text>
              {campaign.donations.slice(0, 5).map((donation: CampaignDonation) => (
                <Surface key={donation.id} style={styles.donationCard} elevation={1}>
                  <View style={styles.donationRow}>
                    <Avatar.Text
                      size={36}
                      label={donation.isAnonymous ? '?' : donation.donorName.charAt(0).toUpperCase()}
                      style={{ backgroundColor: donation.isAnonymous ? '#9E9E9E' : brandColors.primary }}
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
            <ActivityIndicator size="small" color={brandColors.primary} style={{ marginVertical: 12 }} />
          ) : collaborators.length > 0 ? (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Collaborators
              </Text>
              {collaborators.map((c) => (
                <Surface key={c.id} style={styles.collaboratorCard} elevation={1}>
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
              <Chip key={b} style={styles.chip}>
                {b}
              </Chip>
            ))}
          </View>

          {/* Payment Methods */}
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Accepted Payment Methods
          </Text>
          <Surface style={styles.paymentMethodsCard} elevation={1}>
            {[
              { icon: 'cellphone', label: 'Mobile Money' },
              { icon: 'credit-card-outline', label: 'Debit / Credit Card' },
              { icon: 'bank-outline', label: 'Bank Transfer' },
            ].map((method) => (
              <View key={method.label} style={styles.paymentMethodItem}>
                <Icon source={method.icon} size={20} color={brandColors.textSecondary} />
                <Text variant="bodySmall">{method.label}</Text>
              </View>
            ))}
          </Surface>

          {/* Report */}
          <Button
            mode="text"
            icon="flag-outline"
            textColor={brandColors.error}
            style={styles.reportButton}
            labelStyle={styles.reportLabel}
            onPress={() => Alert.alert(
              'Report Campaign',
              'Are you sure you want to report this campaign for review?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Report', style: 'destructive', onPress: () => {
                  api.post(`/reports`, { campaignId: campaign.id, reason: 'Flagged from mobile' })
                    .then(() => Alert.alert('Reported', 'Thank you. Our team will review this campaign.'))
                    .catch(() => Alert.alert('Error', 'Could not submit report. Please try again.'))
                }},
              ]
            )}
          >
            Report Campaign
          </Button>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* Donation Modal */}
      <Modal
        visible={donateModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDonateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              Donate to Campaign
            </Text>
            <Text variant="bodySmall" style={[styles.muted, { marginBottom: 16 }]}>
              {campaign.title}
            </Text>

            <Text variant="labelLarge" style={styles.fieldLabel}>Amount (GHS)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 50"
              placeholderTextColor="rgba(26,46,34,0.35)"
              keyboardType="numeric"
              value={donateAmount}
              onChangeText={setDonateAmount}
              editable={!isDonating}
            />

            <Text variant="labelLarge" style={styles.fieldLabel}>Payment Method</Text>
            {providersLoading ? (
              <ActivityIndicator size="small" color={brandColors.primary} style={{ marginVertical: 12 }} />
            ) : providersError || providers.length === 0 ? (
              <View style={styles.paymentFallback}>
                <Icon source="wallet" size={20} color={brandColors.primary} />
                <Text variant="bodySmall" style={styles.paymentFallbackText}>
                  {providersError ? 'Could not load payment methods. Wallet will be used.' : 'No payment methods available.'}
                </Text>
              </View>
            ) : (
              <View style={styles.providerList}>
                {providers.map((provider) => (
                  <TouchableOpacity
                    key={provider.id}
                    style={[
                      styles.providerOption,
                      selectedProvider?.id === provider.id && styles.providerOptionActive,
                    ]}
                    onPress={() => setSelectedProvider(provider)}
                    disabled={isDonating}
                  >
                    <Icon
                      source={getProviderIcon(provider.type)}
                      size={20}
                      color={selectedProvider?.id === provider.id ? brandColors.primary : brandColors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.providerOptionText,
                        selectedProvider?.id === provider.id && styles.providerOptionTextActive,
                      ]}
                    >
                      {provider.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text variant="labelLarge" style={styles.fieldLabel}>Message (optional)</Text>
            <TextInput
              style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Leave a message of support..."
              placeholderTextColor="rgba(26,46,34,0.35)"
              multiline
              value={donateMessage}
              onChangeText={setDonateMessage}
              editable={!isDonating}
            />

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setDonateModalVisible(false)}
                style={{ flex: 1, marginRight: 8, borderRadius: 999 }}
                disabled={isDonating}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                buttonColor={brandColors.primary}
                onPress={handleDonate}
                style={{ flex: 1, marginLeft: 8, borderRadius: 999 }}
                disabled={isDonating || !donateAmount || (!providersLoading && providers.length === 0 && !providersError)}
                loading={isDonating}
              >
                {isDonating ? 'Processing...' : 'Confirm'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const CARD_BORDER = 'rgba(26,46,34,0.10)'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroImage: { width: '100%', height: 240 },
  content: { padding: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { height: 28, backgroundColor: 'rgba(168,181,160,0.28)' },
  chipText: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: brandColors.text },
  title: { fontFamily: 'TTSquares-Bold', marginBottom: 16 },
  progressCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: brandColors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  raised: { color: brandColors.success, fontFamily: 'TTSquares-Bold' },
  muted: { color: brandColors.textSecondary },
  statRight: { alignItems: 'flex-end' },
  donateButton: { borderRadius: 999, marginBottom: 24, paddingVertical: 4 },
  donateLabel: { fontSize: 16, fontFamily: 'TTSquares-Bold' },
  sectionTitle: { fontFamily: 'TTSquares-Bold', marginBottom: 8, marginTop: 8 },
  description: { lineHeight: 22, color: brandColors.textSecondary, marginBottom: 16 },
  collaboratorAvatarRow: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  collaboratorAvatar: { backgroundColor: brandColors.primaryLight },
  collaboratorCard: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: brandColors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  collaboratorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  collaboratorInfo: { flex: 1 },
  collaboratorName: { fontFamily: 'TTSquares-Bold' },
  stillNeeded: { color: brandColors.textSecondary, textAlign: 'center', marginTop: -12, marginBottom: 20, fontFamily: 'Outfit_400Regular' },
  datesCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: brandColors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  dateRow: { flexDirection: 'row', justifyContent: 'space-around' },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { fontFamily: 'TTSquares-Bold', color: brandColors.text },
  creatorCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: brandColors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creatorInfo: { flex: 1 },
  creatorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  donationCard: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: brandColors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  donationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  donationInfo: { flex: 1 },
  donationAmount: { alignItems: 'flex-end' },
  paymentMethodsCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: brandColors.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  paymentMethodItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  reportButton: { alignSelf: 'flex-end', marginTop: 4 },
  reportLabel: { fontSize: 13, fontFamily: 'TTSquares-Bold' },

  // Donation modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: brandColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { fontFamily: 'TTSquares-Bold', marginBottom: 4 },
  fieldLabel: { fontFamily: 'TTSquares-Bold', marginBottom: 6, marginTop: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    marginBottom: 12,
    color: brandColors.text,
  },
  paymentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  paymentOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
  },
  paymentOptionActive: {
    borderColor: brandColors.primary,
    backgroundColor: 'rgba(46,61,47,0.08)',
  },
  paymentOptionText: { fontSize: 12, color: brandColors.textSecondary, fontFamily: 'TTSquares-Bold' },
  paymentOptionTextActive: { color: brandColors.primary },
  providerList: { gap: 8, marginBottom: 12 },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: brandColors.surface,
  },
  providerOptionActive: {
    borderColor: brandColors.primary,
    backgroundColor: 'rgba(46,61,47,0.08)',
  },
  providerOptionText: { fontSize: 13, color: brandColors.textSecondary, fontFamily: 'TTSquares-Bold' },
  providerOptionTextActive: { color: brandColors.primary },
  paymentFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: brandColors.surface,
    marginBottom: 12,
  },
  paymentFallbackText: { flex: 1, fontSize: 13, color: brandColors.textSecondary, fontFamily: 'Outfit_400Regular' },
  modalActions: { flexDirection: 'row', marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  shareButton: { flex: 1, borderRadius: 999 },
  shareLabel: { fontSize: 16, fontFamily: 'TTSquares-Bold' },
})
