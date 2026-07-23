import { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet, Alert, Modal, TextInput, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { Text, Button, Chip, ActivityIndicator, Surface, Icon } from 'react-native-paper'
import { useCampaign } from '@/hooks/useCampaigns'
import { useEnabledPaymentProviders, EnabledPaymentProvider, getProviderIcon } from '@/hooks/useEnabledPaymentProviders'
import { ProgressBar } from '@/components/ProgressBar'
import { brandColors } from '@/theme'
import { api } from '@/lib/api'

export default function DonateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { campaign, isLoading, error } = useCampaign(id ?? '')

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
        currency: campaign?.currency ?? 'USD',
        paymentMethod: selectedProvider.slug,
        message: donateMessage || undefined,
        isAnonymous: false,
      })
      Alert.alert('Thank You!', 'Your donation was submitted successfully.')
      router.replace(`/campaign/${id}`)
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

  return (
    <>
      <Stack.Screen options={{ title: `Donate to ${campaign.title}` }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <Text variant="titleLarge" style={{ fontFamily: 'TTSquares-Bold', marginBottom: 16 }}>
          {campaign.title}
        </Text>

        <Surface style={styles.progressCard} elevation={1}>
          <ProgressBar progress={progress} />
          <View style={styles.statsRow}>
            <View>
              <Text variant="titleMedium" style={styles.raised}>
                {campaign.currency} {campaign.raisedAmount.toLocaleString()}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                raised of {campaign.currency} {campaign.goalAmount.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statRight}>
              <Text variant="titleMedium">{Math.round(progress * 100)}%</Text>
              <Text variant="bodySmall" style={styles.muted}>funded</Text>
            </View>
          </View>
        </Surface>

        <Text variant="labelLarge" style={styles.fieldLabel}>Amount ({campaign.currency})</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="e.g. 50"
          placeholderTextColor="#999"
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
                  color={selectedProvider?.id === provider.id ? brandColors.primary : '#555'}
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
          placeholderTextColor="#999"
          multiline
          value={donateMessage}
          onChangeText={setDonateMessage}
          editable={!isDonating}
        />

        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={{ flex: 1, marginRight: 8 }}
            disabled={isDonating}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            buttonColor={brandColors.primary}
            onPress={handleDonate}
            style={{ flex: 1, marginLeft: 8 }}
            disabled={isDonating || !donateAmount || (!providersLoading && providers.length === 0 && !providersError)}
            loading={isDonating}
          >
            {isDonating ? 'Processing...' : 'Donate'}
          </Button>
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progressCard: { padding: 16, borderRadius: 12, marginBottom: 16, backgroundColor: '#FFFFFF' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  raised: { color: '#2E7D32', fontFamily: 'TTSquares-Bold' },
  muted: { color: '#757575' },
  statRight: { alignItems: 'flex-end' },
  fieldLabel: { fontFamily: 'TTSquares-Bold', marginBottom: 6, marginTop: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'TTSquares-Regular',
    marginBottom: 12,
    color: '#1a1a1a',
    backgroundColor: '#FFFFFF',
  },
  paymentFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  paymentFallbackText: { flex: 1, fontSize: 13, color: '#757575', fontFamily: 'TTSquares-Regular' },
  providerList: { gap: 8, marginBottom: 12 },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFFFFF',
  },
  providerOptionActive: {
    borderColor: brandColors.primary,
    backgroundColor: 'rgba(46,125,50,0.08)',
  },
  providerOptionText: { fontSize: 13, color: '#555', fontFamily: 'TTSquares-Bold' },
  providerOptionTextActive: { color: brandColors.primary },
  modalActions: { flexDirection: 'row', marginTop: 8 },
})
