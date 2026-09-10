import { PayoutAccounts } from '@/components/PayoutAccounts'
import { useState, useEffect, useCallback, useMemo } from 'react'
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
import {
  usePalette,
  useNeu,
  useColorMode,
  type ColorModePreference,
} from '@/context/ColorModeContext'
import { SKINS, type Palette, type NeuRecipes } from '@/theme'
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

const APPEARANCE_OPTIONS: { value: ColorModePreference; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
  { value: 'system', label: 'System', icon: 'cellphone-cog' },
]

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

// Shared style factory — built from the active palette so a mode switch recolors
// everything. Screens call `useStyles()` (below) to get the memoized result.
function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },

    sectionTitle: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: p.textSecondary, paddingHorizontal: 20, marginTop: 24, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: `${p.error}1A` },
    errorBannerText: { flex: 1, fontSize: 13, fontFamily: 'Outfit_500Medium', color: p.error },

    card: {
      ...neu.raised,
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
      borderBottomColor: p.border,
    },
    toggleIcon: {
      ...neu.subtle,
      width: 34,
      height: 34,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    toggleLabel: { flex: 1, fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.text },

    pickerValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pickerValueText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.primary },
    pickerOptions: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
    pickerOption: { ...neu.subtle, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
    pickerOptionActive: { ...neu.greenInset },
    pickerOptionText: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: p.text },
    pickerOptionTextActive: { color: '#fff' },

    appearanceRow: { flexDirection: 'row', gap: 8, padding: 12 },
    appearanceOption: {
      ...neu.subtle,
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 12,
      borderRadius: 12,
    },
    appearanceOptionActive: { ...neu.greenInset },
    appearanceLabel: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: p.text },
    appearanceLabelActive: { color: '#fff' },

    skinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
    skinOption: {
      ...neu.subtle,
      width: '47%',
      flexGrow: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 14,
      borderRadius: 12,
    },
    skinOptionActive: { ...neu.greenInset },
    skinLabel: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: p.text },
    skinLabelActive: { color: '#fff' },

    dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 44 },
    dangerText: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.error },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonToggleRows() {
  const p = usePalette()
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
            <View style={{ width: '50%', height: 14, backgroundColor: p.skeleton, borderRadius: 4, marginBottom: 4 }} />
            <View style={{ width: '30%', height: 10, backgroundColor: p.skeleton, borderRadius: 4 }} />
          </View>
          <View style={{ width: 44, height: 24, backgroundColor: p.skeleton, borderRadius: 12 }} />
        </View>
      ))}
    </Animated.View>
  )
}

// ─── Toggle Row ──────────────────────────────────────────────

function ToggleRow({ icon, label, value, onToggle, color }: {
  icon: string; label: string; value: boolean; onToggle: (v: boolean) => void; color?: string
}) {
  const p = usePalette()
  const styles = useStyles()
  const tint = color ?? p.primary
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.toggleIcon, { backgroundColor: `${tint}14` }]}>
        <Icon source={icon} size={18} color={tint} />
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} color={p.primary} />
    </View>
  )
}

// ─── Picker Row ──────────────────────────────────────────────

function PickerRow({ icon, label, value, options, onChange, color }: {
  icon: string; label: string; value: string; options: string[]; onChange: (v: string) => void; color?: string
}) {
  const p = usePalette()
  const styles = useStyles()
  const [expanded, setExpanded] = useState(false)
  const tint = color ?? p.primaryLight
  return (
    <View>
      <TouchableRipple style={styles.toggleRow} rippleColor={p.ripple} onPress={() => setExpanded(!expanded)}>
        <>
          <View style={[styles.toggleIcon, { backgroundColor: `${tint}14` }]}>
            <Icon source={icon} size={18} color={tint} />
          </View>
          <Text style={styles.toggleLabel}>{label}</Text>
          <View style={styles.pickerValue}>
            <Text style={styles.pickerValueText}>{value}</Text>
            <Icon source={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={p.textSecondary} />
          </View>
        </>
      </TouchableRipple>
      {expanded && (
        <View style={styles.pickerOptions}>
          {options.map((opt) => (
            <TouchableRipple
              key={opt}
              style={[styles.pickerOption, value === opt && styles.pickerOptionActive]}
              rippleColor={p.ripple}
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

// ─── Appearance (light / dark / system) ──────────────────────

function AppearanceRow() {
  const p = usePalette()
  const styles = useStyles()
  const { mode, setMode } = useColorMode()
  return (
    <View style={styles.appearanceRow}>
      {APPEARANCE_OPTIONS.map((opt) => {
        const active = mode === opt.value
        return (
          <TouchableRipple
            key={opt.value}
            style={[styles.appearanceOption, active && styles.appearanceOptionActive]}
            rippleColor={p.ripple}
            onPress={() => setMode(opt.value)}
            accessibilityLabel={`${opt.label} appearance`}
            accessibilityState={{ selected: active }}
          >
            <>
              <Icon source={opt.icon} size={20} color={active ? '#fff' : p.primary} />
              <Text style={[styles.appearanceLabel, active && styles.appearanceLabelActive]}>
                {opt.label}
              </Text>
            </>
          </TouchableRipple>
        )
      })}
    </View>
  )
}

// ─── Design finish (skin) ────────────────────────────────────

function SkinRow() {
  const p = usePalette()
  const styles = useStyles()
  const { skin, setSkin } = useColorMode()
  return (
    <View style={styles.skinRow}>
      {SKINS.map((opt) => {
        const active = skin === opt.value
        return (
          <TouchableRipple
            key={opt.value}
            style={[styles.skinOption, active && styles.skinOptionActive]}
            rippleColor={p.ripple}
            onPress={() => setSkin(opt.value)}
            accessibilityLabel={`${opt.label} finish`}
            accessibilityState={{ selected: active }}
          >
            <>
              <Icon source={opt.icon} size={20} color={active ? '#fff' : p.primary} />
              <Text style={[styles.skinLabel, active && styles.skinLabelActive]}>
                {opt.label}
              </Text>
            </>
          </TouchableRipple>
        )
      })}
    </View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const p = usePalette()
  const styles = useStyles()
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
    headerStyle: { backgroundColor: p.background },
    headerTintColor: p.text,
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
                <Icon source="alert-circle-outline" size={18} color={p.error} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            <PayoutAccounts />
            {/* Appearance */}
            <Text style={styles.sectionTitle}>Appearance</Text>
            <View style={styles.card}>
              <AppearanceRow />
            </View>

            {/* Design finish */}
            <Text style={styles.sectionTitle}>Design finish</Text>
            <View style={styles.card}>
              <SkinRow />
            </View>

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
                <View style={[styles.toggleIcon, { backgroundColor: `${p.success}14` }]}>
                  <Icon source="cash" size={18} color={p.success} />
                </View>
                <Text style={styles.toggleLabel}>Currency</Text>
                <Text style={styles.pickerValueText}>GHS</Text>
              </View>
              <PickerRow icon="translate" label="Language" value={settings.language} options={LANGUAGES} onChange={(v) => updateSetting('language', v)} color={p.textSecondary} />
            </View>

            {/* Privacy */}
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.card}>
              <ToggleRow icon="eye-off-outline" label="Anonymous Donations" value={settings.anonymousDonations} onToggle={(v) => updateSetting('anonymousDonations', v)} color={p.textSecondary} />
              <ToggleRow icon="trophy-outline" label="Show on Leaderboard" value={settings.showOnLeaderboard} onToggle={(v) => updateSetting('showOnLeaderboard', v)} color={p.secondary} />
            </View>

            {/* Danger Zone */}
            <Text style={[styles.sectionTitle, { color: p.error }]}>Danger Zone</Text>
            <View style={styles.card}>
              <TouchableRipple style={styles.dangerRow} rippleColor={`${p.error}1A`} onPress={handleDeleteAccount}>
                <>
                  <Icon source="delete-outline" size={20} color={p.error} />
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
