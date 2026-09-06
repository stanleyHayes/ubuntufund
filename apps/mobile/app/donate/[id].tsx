import { BrandedNativeInput as TextInput } from '@/components/BrandedNativeInput'
import { useState, useEffect, useMemo } from 'react'
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { Text, Button, ActivityIndicator, Surface, Icon } from 'react-native-paper'
import { useCampaign } from '@/hooks/useCampaigns'
import { useEnabledPaymentProviders, EnabledPaymentProvider, getProviderIcon } from '@/hooks/useEnabledPaymentProviders'
import { ProgressBar } from '@/components/ProgressBar'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { api } from '@/lib/api'

const FALLBACK_WALLET_PROVIDER: EnabledPaymentProvider = {
  id: 'fallback-wallet', name: 'Wallet', slug: 'wallet', type: 'wallet', isDefault: true, feePercent: 0,
}

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 2,
      color: p.secondaryDark,
      marginBottom: 6,
    },
    campaignTitle: { fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 16 },
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
      backgroundColor: p.surface,
    },
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
    modalActions: { flexDirection: 'row', marginTop: 8 },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

export default function DonateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { campaign, isLoading, error } = useCampaign(id ?? '')
  const p = usePalette()
  const styles = useStyles()

  const [donateAmount, setDonateAmount] = useState('')
  const [donateMessage, setDonateMessage] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<EnabledPaymentProvider | null>(null)
  const [isDonating, setIsDonating] = useState(false)

  const { providers, isLoading: providersLoading, error: providersError } = useEnabledPaymentProviders()

  useEffect(() => {
    if (selectedProvider) return
    if (providers.length > 0) {
      const defaultProvider = providers.find((p) => p.isDefault) ?? providers[0]
      setSelectedProvider(defaultProvider)
    } else if (providersError) {
      setSelectedProvider(FALLBACK_WALLET_PROVIDER)
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
      Alert.alert('Payment Method Unavailable', 'This provider is not configured for live payments.')
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
        <ActivityIndicator size="large" color={p.primary} />
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
        <Text style={styles.eyebrow}>SUPPORT THIS CAMPAIGN</Text>
        <Text variant="titleLarge" style={styles.campaignTitle}>
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
          </View>
        </Surface>

        <Text variant="labelLarge" style={styles.fieldLabel}>Amount (GHS)</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="e.g. 50"
          placeholderTextColor={`${p.text}59`}
          keyboardType="numeric"
          value={donateAmount}
          onChangeText={setDonateAmount}
          editable={!isDonating}
        />

        <Text variant="labelLarge" style={styles.fieldLabel}>Payment Method</Text>
        {providersLoading ? (
          <ActivityIndicator size="small" color={p.primary} style={{ marginVertical: 12 }} />
        ) : providersError || providers.length === 0 ? (
          <View style={styles.paymentFallback}>
            <Icon source="wallet" size={20} color={p.primary} />
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
                  color={selectedProvider?.id === provider.id ? p.primary : p.textSecondary}
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
          placeholderTextColor={`${p.text}59`}
          multiline
          value={donateMessage}
          onChangeText={setDonateMessage}
          editable={!isDonating}
        />

        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={{ flex: 1, marginRight: 8, borderRadius: 999 }}
            disabled={isDonating}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            buttonColor={p.secondary}
            textColor="#221B0E"
            onPress={handleDonate}
            style={{ flex: 1, marginLeft: 8, borderRadius: 999 }}
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
