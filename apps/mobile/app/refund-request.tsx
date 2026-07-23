import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Text, Icon, Button, ActivityIndicator } from 'react-native-paper'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { brandColors } from '@/theme'

interface DonationDetail {
  id: string
  amount: number
  currency: string
  campaignTitle?: string
  campaignId: string
  status: string
  createdAt: string
}

const REASONS = [
  'Campaign not delivering',
  'Changed my mind',
  'Duplicate donation',
  'Other',
]

// ─── Skeleton ────────────────────────────────────────────────

function FormSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start()
  }, [])
  return (
    <Animated.View style={{ opacity, padding: 16 }}>
      <View style={{ width: '100%', height: 80, backgroundColor: '#E0E0E0', borderRadius: 14, marginBottom: 20 }} />
      <View style={{ width: '40%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 12 }} />
      <View style={{ width: '100%', height: 44, backgroundColor: '#E0E0E0', borderRadius: 10, marginBottom: 8 }} />
      <View style={{ width: '100%', height: 44, backgroundColor: '#E0E0E0', borderRadius: 10, marginBottom: 8 }} />
      <View style={{ width: '100%', height: 44, backgroundColor: '#E0E0E0', borderRadius: 10, marginBottom: 8 }} />
      <View style={{ width: '100%', height: 44, backgroundColor: '#E0E0E0', borderRadius: 10, marginBottom: 20 }} />
      <View style={{ width: '40%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 12 }} />
      <View style={{ width: '100%', height: 100, backgroundColor: '#E0E0E0', borderRadius: 10 }} />
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function RefundRequestScreen() {
  const { donationId } = useLocalSearchParams<{ donationId: string }>()
  const { user } = useAuth()
  const [donation, setDonation] = useState<DonationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchDonation = useCallback(async () => {
    if (!donationId) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<DonationDetail>(`/donations/${donationId}`)
      setDonation(data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load donation')
    } finally {
      setLoading(false)
    }
  }, [donationId])

  useEffect(() => {
    fetchDonation()
  }, [fetchDonation])

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
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to submit refund request.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Refund Request',
            headerStyle: { backgroundColor: brandColors.primary },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
          }}
        />
        <View style={styles.successState}>
          <View style={styles.successIcon}>
            <Icon source="check-circle" size={56} color={brandColors.primary} />
          </View>
          <Text style={styles.successTitle}>Refund Request Submitted</Text>
          <Text style={styles.successSubtitle}>Your refund ID is:</Text>
          <Text style={styles.refundId}>{success}</Text>
          <Text style={styles.successNote}>
            A 2% processing fee applies. Expect 5-7 business days for processing.
          </Text>
          <Button
            mode="contained"
            onPress={() => router.push('/my-refunds')}
            style={{ marginTop: 24, backgroundColor: brandColors.primary }}
            labelStyle={{ fontFamily: 'TTSquares-Bold' }}
          >
            View My Refunds
          </Button>
          <Button
            mode="text"
            onPress={() => router.back()}
            style={{ marginTop: 8 }}
            labelStyle={{ fontFamily: 'TTSquares-Bold', color: brandColors.primary }}
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
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <FormSkeleton />
        ) : error ? (
          <View style={styles.emptyState}>
            <Icon source="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button mode="outlined" onPress={fetchDonation} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : (
          <View style={{ padding: 16 }}>
            {/* Donation Details */}
            {donation && (
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Donation Details</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Campaign</Text>
                  <Text style={styles.detailValue}>{donation.campaignTitle ?? 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Amount</Text>
                  <Text style={[styles.detailValue, { color: brandColors.primary, fontFamily: 'TTSquares-Bold' }]}>
                    {donation.currency ?? '$'}{donation.amount}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(donation.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />

            {/* Policy Note */}
            <View style={styles.policyCard}>
              <Icon source="information-outline" size={18} color="#1565C0" />
              <Text style={styles.policyText}>
                A 2% processing fee will be deducted from the refund. Refunds typically take 5-7 business days to process.
              </Text>
            </View>

            {/* Submit */}
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting || !selectedReason}
              style={[styles.submitBtn, (!selectedReason) && { opacity: 0.5 }]}
              labelStyle={{ fontFamily: 'TTSquares-Bold', fontSize: 16 }}
            >
              Submit Refund Request
            </Button>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F4' },

  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  detailLabel: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#999', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  detailKey: { fontSize: 14, color: '#666', fontFamily: 'TTSquares-Regular' },
  detailValue: { fontSize: 14, color: '#1a1a1a', fontFamily: 'TTSquares-Regular' },

  fieldLabel: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 10 },

  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  reasonOptionActive: { borderColor: brandColors.primary, backgroundColor: `${brandColors.primary}08` },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioOuterActive: { borderColor: brandColors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: brandColors.primary },
  reasonText: { fontSize: 14, color: '#666', fontFamily: 'TTSquares-Regular' },
  reasonTextActive: { color: '#1a1a1a', fontFamily: 'TTSquares-Bold' },

  textArea: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
    fontSize: 14,
    fontFamily: 'TTSquares-Regular',
    color: '#1a1a1a',
    minHeight: 100,
  },

  policyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
  },
  policyText: { flex: 1, fontSize: 13, color: '#1565C0', lineHeight: 18, fontFamily: 'TTSquares-Regular' },

  submitBtn: { marginTop: 24, backgroundColor: brandColors.primary, borderRadius: 12, paddingVertical: 4 },

  successState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 22, fontFamily: 'TTSquares-Black', color: '#1a1a1a', marginBottom: 8 },
  successSubtitle: { fontSize: 14, color: '#666', fontFamily: 'TTSquares-Regular' },
  refundId: { fontSize: 18, fontFamily: 'TTSquares-Bold', color: brandColors.primary, marginTop: 4, marginBottom: 16 },
  successNote: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 18, fontFamily: 'TTSquares-Regular' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#666', marginTop: 16, textAlign: 'center' },
})
