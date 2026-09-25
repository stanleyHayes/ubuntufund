import { BiometricSettings } from '@/components/BiometricSettings'
import { MfaSettings } from '@/components/MfaSettings'
import { PublicationReviews } from '@/components/PublicationReviews'
import { DataRightsRequests } from '@/components/DataRightsRequests'
import { ActivityAlertSettings } from '@/components/ActivityAlertSettings'
import { NewsletterSettings } from '@/components/NewsletterSettings'
import { BlockedUsers } from '@/components/BlockedUsers'
import { DeleteAccountSection } from '@/components/DeleteAccountSection'
import { TouchableRipple } from '@/components/RoundedControls'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, ScrollView, StyleSheet, Animated } from 'react-native'
import { Text, Icon, Switch } from 'react-native-paper'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { DEFAULT_PRIVACY_SETTINGS, privacySettingPatch, privacySettingsFromProfile, type PrivacySettings } from '@/lib/privacySettings'
import { PublicationConsent } from '@/components/PublicationConsent'
import { SignInRequired } from '@/components/SignInRequired'
import {
  usePalette,
  useNeu,
  useColorMode,
  type ColorModePreference,
} from '@/context/ColorModeContext'
import { SKINS, type Palette, type NeuRecipes } from '@/theme'


const APPEARANCE_OPTIONS: { value: ColorModePreference; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
  { value: 'system', label: 'System', icon: 'cellphone-cog' },
]

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

    pickerValueText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.primary },

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
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_PRIVACY_SETTINGS)
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ anonymousDonations?: boolean; showLeaderboards?: boolean; publicProfile?: boolean }>('/profile')
      setSettings(privacySettingsFromProfile(data))
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

  const updateSetting = useCallback(async <K extends keyof PrivacySettings,>(key: K, value: PrivacySettings[K]) => {
    const previousValue = settings[key]
    setSettings((prev) => ({ ...prev, [key]: value }))
    setError(null)
    try {
      await api.put('/profile', privacySettingPatch(key, value, automatedReviewConsent))
    } catch (err) {
      // Includes the API's "saved for safety review" answer when going public.
      setSettings((prev) => ({ ...prev, [key]: previousValue }))
      setError(err instanceof Error ? err.message : 'Could not save that setting')
    }
  }, [settings, automatedReviewConsent])

  const handleAccountDeleted = async () => {
    await logout()
    router.replace('/(auth)/login')
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
              <ActivityAlertSettings />
              <NewsletterSettings />
              <Text>SMS and device push notifications are not available yet. Choose inbox alerts or emails above for supported activity updates.</Text>
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
            </View>

            <BiometricSettings key={`biometric-${user?.id}`} />
            <MfaSettings key={user?.id} />
            {/* Privacy */}
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.card}>
              <ToggleRow icon="eye-off-outline" label="Anonymous Donations" value={settings.anonymousDonations} onToggle={(v) => updateSetting('anonymousDonations', v)} color={p.textSecondary} />
              <ToggleRow icon="trophy-outline" label="Show on Leaderboard" value={settings.showOnLeaderboard} onToggle={(v) => updateSetting('showOnLeaderboard', v)} color={p.secondary} />
              <ToggleRow icon="account-eye-outline" label="Public profile" value={settings.publicProfile} onToggle={(v) => updateSetting('publicProfile', v)} color={p.primary} />
              <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                <PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} />
              </View>
            </View>

            <BlockedUsers />
              <PublicationReviews />
              <DataRightsRequests />
            {/* Danger Zone */}
            <Text style={[styles.sectionTitle, { color: p.error }]}>Danger Zone</Text>
            <View style={styles.card}>
              <DeleteAccountSection rowStyle={styles.dangerRow} textStyle={styles.dangerText} onDeleted={handleAccountDeleted} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
