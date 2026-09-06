import { BrandedNativeInput as TextInput } from '@/components/BrandedNativeInput'
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Text, Icon, Button } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'
import { SignInRequired } from '@/components/SignInRequired'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

interface DonationDetail {
  id: string
  amount: number
  currency: string
  // API (DonationDetailDTO) sends `campaignName` + `date`; keep the older
  // aliases as fallbacks so both wire shapes render correctly.
  campaignName?: string
  campaignTitle?: string
  campaignId: string
  status?: string
  date?: string
  createdAt?: string
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const REASONS = [
  'Campaign not delivering',
  'Changed my mind',
  'Duplicate donation',
  'Other',
]

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },

    headerBlock: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
    eyebrow: { fontSize: 11, fontFamily: 'Outfit_700Bold', fontWeight: '700', color: p.secondaryDark, textTransform: 'uppercase', letterSpacing: 2 },
    pageTitle: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: p.text, marginTop: 4 },
    pageLede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 4 },

    detailCard: {
      ...neu.raised,
      borderRadius: 14,
      padding: 16,
      marginBottom: 24,
    },
    detailLabel: { fontSize: 11, fontFamily: 'Outfit_700Bold', fontWeight: '700', color: p.secondaryDark, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 2 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.border },
    detailKey: { fontSize: 14, color: p.textSecondary, fontFamily: 'Outfit_400Regular' },
    detailValue: { fontSize: 14, color: p.text, fontFamily: 'Outfit_400Regular' },

    fieldLabel: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 10 },

    reasonOption: {
      ...neu.subtle,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 10,
      marginBottom: 8,
    },
    reasonOptionActive: { ...neu.inset },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: p.textSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    radioOuterActive: { borderColor: p.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.primary },
    reasonText: { fontSize: 14, color: p.textSecondary, fontFamily: 'Outfit_400Regular' },
    reasonTextActive: { color: p.text, fontFamily: 'Outfit_700Bold' },

    textArea: {
      ...neu.inset,
      borderRadius: 10,
      padding: 14,
      fontSize: 14,
      fontFamily: 'Outfit_400Regular',
      color: p.text,
      minHeight: 100,
    },

    policyCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: p.skeleton,
      borderRadius: 10,
      padding: 14,
      marginTop: 20,
    },
    policyText: { flex: 1, fontSize: 13, color: p.text, lineHeight: 18, fontFamily: 'Outfit_400Regular' },

    submitBtn: { borderRadius: 999, paddingVertical: 4 },
    bottomBar: {
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: p.background,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },

    successState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    successIconTile: {
      ...neu.subtle,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${p.success}24`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    successTitle: { fontSize: 22, fontFamily: 'Outfit_800ExtraBold', color: p.text, marginBottom: 8 },
    successSubtitle: { fontSize: 14, color: p.textSecondary, fontFamily: 'Outfit_400Regular' },
    refundId: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: p.primary, marginTop: 4, marginBottom: 16 },
    successNote: { fontSize: 13, color: p.textSecondary, textAlign: 'center', lineHeight: 18, fontFamily: 'Outfit_400Regular' },
    viewRefundsBtn: { marginTop: 24, borderRadius: 999 },
    btnLabel: { fontFamily: 'Outfit_700Bold' },

    skeletonLine: { height: 14, backgroundColor: p.skeleton, borderRadius: 4 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 72, paddingHorizontal: 32 },
    emptyIconTile: {
      ...neu.subtle,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: p.skeleton,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    errorIconTile: { backgroundColor: `${p.error}24` },
    emptyTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text, textAlign: 'center' },
    actionBtn: { marginTop: 16, borderRadius: 999 },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

// ─── Skeleton ────────────────────────────────────────────────

function FormSkeleton() {
  const styles = useStyles()
  const [opacity] = useState(() => new Animated.Value(0.3))
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start()
  }, [opacity])
  return (
    <Animated.View style={{ opacity, padding: 16 }}>
      <View style={[styles.skeletonLine, { width: '100%', height: 80, borderRadius: 14, marginBottom: 20 }]} />
      <View style={[styles.skeletonLine, { width: '40%', marginBottom: 12 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 44, borderRadius: 10, marginBottom: 8 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 44, borderRadius: 10, marginBottom: 8 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 44, borderRadius: 10, marginBottom: 8 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 44, borderRadius: 10, marginBottom: 20 }]} />
      <View style={[styles.skeletonLine, { width: '40%', marginBottom: 12 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 100, borderRadius: 10 }]} />
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function RefundRequestScreen() {
  const { donationId } = useLocalSearchParams<{ donationId: string }>()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const p = usePalette()
  const styles = useStyles()
  const [donation, setDonation] = useState<DonationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchDonation = useCallback(async () => {
    if (!user || !donationId) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<DonationDetail>(`/donations/${donationId}`)
      setDonation(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donation')
    } finally {
      setLoading(false)
    }
  }, [user, donationId])

  useEffect(() => {
    if (!user) return
    fetchDonation()
  }, [user, fetchDonation])

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Select a Reason', 'Please choose a reason for your refund request.')
      return
    }
    setSubmitting(true)
    try {
      const result = await api.post<{ id: string }>('/refunds', {
        donationId,
        reason: selectedReason,
        description,
      })
      setSuccess(result.id ?? 'REF-PENDING')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit refund request.')
    } finally {
      setSubmitting(false)
    }
  }

  const headerOptions = {
    title: 'Refund Request',
    headerStyle: { backgroundColor: p.primary },
    headerTintColor: p.onPrimary,
    headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <SignInRequired what="refund request" />
      </View>
    )
  }

  if (success) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Refund Request',
            headerStyle: { backgroundColor: p.primary },
            headerTintColor: p.onPrimary,
            headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
          }}
        />
        <View style={styles.successState}>
          <View style={styles.successIconTile}>
            <Icon source="check-circle" size={32} color={p.success} />
          </View>
          <Text style={styles.successTitle}>Refund Request Submitted</Text>
          <Text style={styles.successSubtitle}>Your refund ID is:</Text>
          <Text style={styles.refundId}>{success}</Text>
          <Text style={styles.successNote}>
            A 2% request fee is recorded. Settlement is not automatic and no processing time is guaranteed.
          </Text>
          <Button
            mode="contained"
            buttonColor={p.primary}
            textColor="#FFFFFF"
            onPress={() => router.push('/my-refunds')}
            style={styles.viewRefundsBtn}
            labelStyle={styles.btnLabel}
          >
            View My Refunds
          </Button>
          <Button
            mode="text"
            onPress={() => router.back()}
            style={{ marginTop: 8 }}
            textColor={p.primary}
            labelStyle={styles.btnLabel}
          >
            Go Back
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Refund Request',
          headerStyle: { backgroundColor: p.primary },
          headerTintColor: p.onPrimary,
          headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
        }}
      />

      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Refund Request</Text>
        <Text style={styles.pageTitle}>Request a Refund</Text>
        <Text style={styles.pageLede}>Tell us why, and we'll take it from there.</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {loading ? (
          <FormSkeleton />
        ) : error ? (
          <EmptyState
            variant="error"
            icon="alert-circle-outline"
            title={error}
            ctaLabel="Retry"
            onCtaPress={fetchDonation}
          />
        ) : (
          <View style={{ padding: 16, paddingTop: 4 }}>
            {/* Donation Details */}
            {donation && (
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Donation Details</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Campaign</Text>
                  <Text style={styles.detailValue}>{donation.campaignName ?? donation.campaignTitle ?? 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Amount</Text>
                  <Text style={[styles.detailValue, { color: p.primary, fontFamily: 'Outfit_700Bold' }]}>
                    GH₵ {donation.amount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Date</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(donation.date ?? donation.createdAt)}
                  </Text>
                </View>
              </View>
            )}

            {/* Reason Picker */}
            <Text style={styles.fieldLabel}>Reason for Refund</Text>
            {REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonOption, selectedReason === reason && styles.reasonOptionActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedReason(reason)}
              >
                <View style={[styles.radioOuter, selectedReason === reason && styles.radioOuterActive]}>
                  {selectedReason === reason && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.reasonText, selectedReason === reason && styles.reasonTextActive]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Description */}
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Additional Details (Optional)</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              placeholder="Describe your reason in more detail..."
              placeholderTextColor={p.textSecondary}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />

            {/* Policy Note */}
            <View style={styles.policyCard}>
              <Icon source="information-outline" size={18} color={p.primary} />
              <Text style={styles.policyText}>
                A 2% processing fee will be deducted from the refund. Refunds typically take 5-7 business days to process.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Submit — docked at the bottom of the screen */}
      {!loading && !error && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            mode="contained"
            buttonColor={p.primary}
            textColor="#FFFFFF"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !selectedReason}
            style={[styles.submitBtn, (!selectedReason) && { opacity: 0.5 }]}
            labelStyle={[styles.btnLabel, { fontSize: 16 }]}
          >
            Submit Refund Request
          </Button>
        </View>
      )}
    </View>
  )
}
