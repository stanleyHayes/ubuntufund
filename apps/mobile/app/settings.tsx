import { useState, useEffect, useCallback } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
  Platform,
} from 'react-native'
import { Text, Icon, Switch, TouchableRipple } from 'react-native-paper'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { SignInRequired } from '@/components/SignInRequired'
import { brandColors, neumorphism } from '@/theme'
import { registerForPushNotificationsAsync, registerPushTokenWithApi } from '@/services/notifications'

interface SettingsData {
  emailNotifications: boolean
  smsNotifications: boolean
  pushNotifications: boolean
  donationReceipts: boolean
  preferredCurrency: string
  language: string
  anonymousDonations: boolean
  showOnLeaderboard: boolean
}

const LANGUAGES = ['English', 'Twi', 'Ga', 'Ewe', 'Hausa']

const DEFAULT_SETTINGS: SettingsData = {
  emailNotifications: true,
  smsNotifications: false,
  pushNotifications: false,
  donationReceipts: true,
  preferredCurrency: 'GHS',
  language: 'English',
  anonymousDonations: false,
  showOnLeaderboard: true,
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonToggleRows() {
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

function PickerRow({ icon, label, value, options, onChange, color = brandColors.primaryLight }: {
  icon: string; label: string; value: string; options: string[]; onChange: (v: string) => void; color?: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <View>
      <TouchableRipple style={styles.toggleRow} rippleColor="rgba(26,46,34,0.08)" onPress={() => setExpanded(!expanded)}>
        <>
          <View style={[styles.toggleIcon, { backgroundColor: `${color}14` }]}>
            <Icon source={icon} size={18} color={color} />
          </View>
          <Text style={styles.toggleLabel}>{label}</Text>
          <View style={styles.pickerValue}>
            <Text style={styles.pickerValueText}>{value}</Text>
            <Icon source={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(26,46,34,0.35)" />
          </View>
        </>
      </TouchableRipple>
      {expanded && (
        <View style={styles.pickerOptions}>
          {options.map((opt) => (
            <TouchableRipple
              key={opt}
              style={[styles.pickerOption, value === opt && styles.pickerOptionActive]}
              rippleColor="rgba(26,46,34,0.12)"
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              onPress={() => { onChange(opt); setExpanded(false) }}
            >
              <Text style={[styles.pickerOptionText, value === opt && styles.pickerOptionTextActive]}>
                {opt}
              </Text>
            </TouchableRipple>
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
      const data = await api.get<{
        notificationPreferences?: { email?: boolean; sms?: boolean; push?: boolean; donationReceipts?: boolean }
        language?: string; anonymousDonations?: boolean; showLeaderboards?: boolean
      }>('/profile')
      setSettings({
        ...DEFAULT_SETTINGS,
        emailNotifications: data.notificationPreferences?.email ?? DEFAULT_SETTINGS.emailNotifications,
        smsNotifications: data.notificationPreferences?.sms ?? DEFAULT_SETTINGS.smsNotifications,
        pushNotifications: data.notificationPreferences?.push ?? DEFAULT_SETTINGS.pushNotifications,
        donationReceipts: data.notificationPreferences?.donationReceipts ?? DEFAULT_SETTINGS.donationReceipts,
        language: data.language ?? DEFAULT_SETTINGS.language,
        anonymousDonations: data.anonymousDonations ?? DEFAULT_SETTINGS.anonymousDonations,
        showOnLeaderboard: data.showLeaderboards ?? DEFAULT_SETTINGS.showOnLeaderboard,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchSettings()
  }, [user, fetchSettings])

  const updateSetting = useCallback(async <K extends keyof SettingsData,>(key: K, value: SettingsData[K]) => {
    const previousValue = settings[key]
    setSettings((prev) => ({ ...prev, [key]: value }))
    setError(null)
    try {
      const payload = key === 'emailNotifications'
        ? { notificationPreferences: { email: value } }
        : key === 'smsNotifications'
          ? { notificationPreferences: { sms: value } }
          : key === 'pushNotifications'
            ? { notificationPreferences: { push: value } }
            : key === 'donationReceipts'
              ? { notificationPreferences: { donationReceipts: value } }
              : key === 'showOnLeaderboard'
                ? { showLeaderboards: value }
                : { [key]: value }
      await api.put('/profile', payload)
    } catch (err) {
      setSettings((prev) => ({ ...prev, [key]: previousValue }))
      setError(err instanceof Error ? err.message : 'Could not save that setting')
    }
  }, [settings])

  const updatePushPermission = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      await updateSetting('pushNotifications', false)
      return
    }

    const token = await registerForPushNotificationsAsync()
    if (!token) {
      setSettings((prev) => ({ ...prev, pushNotifications: false }))
      Alert.alert(
        'Notifications remain off',
        'Permission was not granted. You can enable notifications later in system settings.'
      )
      return
    }

    try {
      await registerPushTokenWithApi(token, Platform.OS === 'ios' ? 'ios' : 'android')
      await updateSetting('pushNotifications', true)
    } catch (err) {
      setSettings((prev) => ({ ...prev, pushNotifications: false }))
      setError(err instanceof Error ? err.message : 'Could not enable push notifications')
    }
  }, [updateSetting])

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This immediately closes your account and signs you out. Financial and safety records may be retained where required by law, fraud prevention, or an active dispute.',
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

  const headerOptions = {
    title: 'Settings',
    headerStyle: { backgroundColor: brandColors.primary },
    headerTintColor: '#FFFFFF',
    headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <SignInRequired what="settings" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <SkeletonToggleRows />
        ) : (
          <>
            {error ? (
              <View style={styles.errorBanner}>
                <Icon source="alert-circle-outline" size={18} color={brandColors.error} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}
            {/* Notifications */}
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.card}>
              <ToggleRow icon="email-outline" label="Email Notifications" value={settings.emailNotifications} onToggle={(v) => updateSetting('emailNotifications', v)} />
              <ToggleRow icon="message-text-outline" label="SMS Notifications" value={settings.smsNotifications} onToggle={(v) => updateSetting('smsNotifications', v)} />
              <ToggleRow icon="bell-outline" label="Push Notifications" value={settings.pushNotifications} onToggle={updatePushPermission} />
              <ToggleRow icon="receipt" label="Donation Receipts" value={settings.donationReceipts} onToggle={(v) => updateSetting('donationReceipts', v)} />
            </View>

            {/* Account */}
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: `${brandColors.success}14` }]}>
                  <Icon source="cash" size={18} color={brandColors.success} />
                </View>
                <Text style={styles.toggleLabel}>Currency</Text>
                <Text style={styles.pickerValueText}>GHS</Text>
              </View>
              <PickerRow icon="translate" label="Language" value={settings.language} options={LANGUAGES} onChange={(v) => updateSetting('language', v)} color={brandColors.textSecondary} />
            </View>

            {/* Privacy */}
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.card}>
              <ToggleRow icon="eye-off-outline" label="Anonymous Donations" value={settings.anonymousDonations} onToggle={(v) => updateSetting('anonymousDonations', v)} color={brandColors.textSecondary} />
              <ToggleRow icon="trophy-outline" label="Show on Leaderboard" value={settings.showOnLeaderboard} onToggle={(v) => updateSetting('showOnLeaderboard', v)} color={brandColors.secondary} />
            </View>

            {/* Danger Zone */}
            <Text style={[styles.sectionTitle, { color: brandColors.error }]}>Danger Zone</Text>
            <View style={styles.card}>
              <TouchableRipple style={styles.dangerRow} rippleColor="rgba(165,67,47,0.10)" onPress={handleDeleteAccount}>
                <>
                  <Icon source="delete-outline" size={20} color={brandColors.error} />
                  <Text style={styles.dangerText}>Delete Account</Text>
                </>
              </TouchableRipple>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },

  sectionTitle: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: brandColors.textSecondary, paddingHorizontal: 20, marginTop: 24, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: 'rgba(165,67,47,0.10)' },
  errorBannerText: { flex: 1, fontSize: 13, fontFamily: 'Outfit_500Medium', color: brandColors.error },

  card: {
    ...neumorphism.raised,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,46,34,0.08)',
  },
  toggleIcon: {
    ...neumorphism.subtle,
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toggleLabel: { flex: 1, fontSize: 15, fontFamily: 'Outfit_700Bold', color: brandColors.text },

  pickerValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pickerValueText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: brandColors.primary },
  pickerOptions: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  pickerOption: { ...neumorphism.subtle, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  pickerOptionActive: { ...neumorphism.greenInset },
  pickerOptionText: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.text },
  pickerOptionTextActive: { color: '#fff' },

  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 44 },
  dangerText: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: brandColors.error },
})
