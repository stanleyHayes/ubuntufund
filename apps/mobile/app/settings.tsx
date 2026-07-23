import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
  TouchableOpacity,
} from 'react-native'
import { Text, Icon, Switch, Button } from 'react-native-paper'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { brandColors } from '@/theme'

interface SettingsData {
  emailNotifications: boolean
  smsNotifications: boolean
  pushNotifications: boolean
  pushDonations: boolean
  pushComments: boolean
  pushMilestones: boolean
  pushCampaigns: boolean
  donationReceipts: boolean
  preferredCurrency: string
  language: string
  anonymousDonations: boolean
  showOnLeaderboard: boolean
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'ZAR', 'KES', 'NGN', 'GHS']
const LANGUAGES = ['English', 'French', 'Swahili', 'Arabic', 'Portuguese']

const DEFAULT_SETTINGS: SettingsData = {
  emailNotifications: true,
  smsNotifications: false,
  pushNotifications: true,
  pushDonations: true,
  pushComments: true,
  pushMilestones: true,
  pushCampaigns: true,
  donationReceipts: true,
  preferredCurrency: 'USD',
  language: 'English',
  anonymousDonations: false,
  showOnLeaderboard: true,
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonToggleRows() {
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
    <Animated.View style={{ opacity, paddingHorizontal: 16, paddingTop: 16 }}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <View style={{ width: '50%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 4 }} />
            <View style={{ width: '30%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
          </View>
          <View style={{ width: 44, height: 24, backgroundColor: '#E0E0E0', borderRadius: 12 }} />
        </View>
      ))}
    </Animated.View>
  )
}

// ─── Toggle Row ──────────────────────────────────────────────

function ToggleRow({ icon, label, value, onToggle, color = brandColors.primary }: {
  icon: string; label: string; value: boolean; onToggle: (v: boolean) => void; color?: string
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.toggleIcon, { backgroundColor: `${color}14` }]}>
        <Icon source={icon} size={18} color={color} />
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} color={brandColors.primary} />
    </View>
  )
}

// ─── Picker Row ──────────────────────────────────────────────

function PickerRow({ icon, label, value, options, onChange, color = '#1565C0' }: {
  icon: string; label: string; value: string; options: string[]; onChange: (v: string) => void; color?: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <View>
      <TouchableOpacity style={styles.toggleRow} activeOpacity={0.7} onPress={() => setExpanded(!expanded)}>
        <View style={[styles.toggleIcon, { backgroundColor: `${color}14` }]}>
          <Icon source={icon} size={18} color={color} />
        </View>
        <Text style={styles.toggleLabel}>{label}</Text>
        <View style={styles.pickerValue}>
          <Text style={styles.pickerValueText}>{value}</Text>
          <Icon source={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#999" />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.pickerOptions}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.pickerOption, value === opt && styles.pickerOptionActive]}
              onPress={() => { onChange(opt); setExpanded(false) }}
            >
              <Text style={[styles.pickerOptionText, value === opt && styles.pickerOptionTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Partial<SettingsData>>('/profile')
      setSettings({ ...DEFAULT_SETTINGS, ...data })
    } catch {
      // Use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSetting = useCallback(async (key: keyof SettingsData, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    try {
      await api.put('/profile', { [key]: value })
    } catch {
      // Revert on failure could be added; for now silently fail
    }
  }, [])

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data, campaigns, and donation history will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/profile')
              await logout()
              router.replace('/(auth)/login')
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.')
            }
          },
        },
      ],
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <SkeletonToggleRows />
        ) : (
          <>
            {/* Notifications */}
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.card}>
              <ToggleRow icon="email-outline" label="Email Notifications" value={settings.emailNotifications} onToggle={(v) => updateSetting('emailNotifications', v)} />
              <ToggleRow icon="message-text-outline" label="SMS Notifications" value={settings.smsNotifications} onToggle={(v) => updateSetting('smsNotifications', v)} />
              <ToggleRow icon="bell-outline" label="Push Notifications" value={settings.pushNotifications} onToggle={(v) => updateSetting('pushNotifications', v)} />
              {settings.pushNotifications && (
                <>
                  <ToggleRow icon="heart-outline" label="Donation Alerts" value={settings.pushDonations} onToggle={(v) => updateSetting('pushDonations', v)} color="#E53935" />
                  <ToggleRow icon="comment-outline" label="Comment Alerts" value={settings.pushComments} onToggle={(v) => updateSetting('pushComments', v)} color="#1565C0" />
                  <ToggleRow icon="flag-outline" label="Milestone Alerts" value={settings.pushMilestones} onToggle={(v) => updateSetting('pushMilestones', v)} color="#2E7D32" />
                  <ToggleRow icon="bullhorn-outline" label="Campaign Alerts" value={settings.pushCampaigns} onToggle={(v) => updateSetting('pushCampaigns', v)} color="#F57F17" />
                </>
              )}
              <ToggleRow icon="receipt" label="Donation Receipts" value={settings.donationReceipts} onToggle={(v) => updateSetting('donationReceipts', v)} />
            </View>

            {/* Account */}
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <PickerRow icon="currency-usd" label="Preferred Currency" value={settings.preferredCurrency} options={CURRENCIES} onChange={(v) => updateSetting('preferredCurrency', v)} color="#2E7D32" />
              <PickerRow icon="translate" label="Language" value={settings.language} options={LANGUAGES} onChange={(v) => updateSetting('language', v)} color="#6A1B9A" />
            </View>

            {/* Privacy */}
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.card}>
              <ToggleRow icon="eye-off-outline" label="Anonymous Donations" value={settings.anonymousDonations} onToggle={(v) => updateSetting('anonymousDonations', v)} color="#78909C" />
              <ToggleRow icon="trophy-outline" label="Show on Leaderboard" value={settings.showOnLeaderboard} onToggle={(v) => updateSetting('showOnLeaderboard', v)} color="#F57F17" />
            </View>

            {/* Danger Zone */}
            <Text style={[styles.sectionTitle, { color: '#E53935' }]}>Danger Zone</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount}>
                <Icon source="delete-outline" size={20} color="#E53935" />
                <Text style={styles.dangerText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F4' },

  sectionTitle: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#999', paddingHorizontal: 20, marginTop: 24, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  toggleIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toggleLabel: { flex: 1, fontSize: 15, fontFamily: 'TTSquares-Bold', color: '#1a1a1a' },

  pickerValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pickerValueText: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  pickerOptions: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F5F5' },
  pickerOptionActive: { backgroundColor: brandColors.primary },
  pickerOptionText: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: '#666' },
  pickerOptionTextActive: { color: '#fff' },

  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  dangerText: { fontSize: 15, fontFamily: 'TTSquares-Bold', color: '#E53935' },
})
