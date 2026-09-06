import { View, StyleSheet } from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { VerificationLevel } from '@ubuntu-fund/types'
import { usePalette } from '@/context/ColorModeContext'

interface TrustBadgeProps {
  level: VerificationLevel
  trustScore: number
}

export function TrustBadge({ level, trustScore }: TrustBadgeProps) {
  const p = usePalette()

  const levelConfig: Record<
    VerificationLevel,
    { label: string; icon: string; color: string; bg: string }
  > = {
    [VerificationLevel.NONE]: {
      label: 'Unverified',
      icon: 'shield-outline',
      color: p.textSecondary,
      bg: `${p.textSecondary}1A`,
    },
    [VerificationLevel.EMAIL_PHONE]: {
      label: 'Basic',
      icon: 'shield-half-full',
      color: p.primaryLight,
      bg: `${p.primaryLight}24`,
    },
    [VerificationLevel.NATIONAL_ID]: {
      label: 'Verified',
      icon: 'shield-check',
      color: p.success,
      bg: `${p.success}1A`,
    },
    [VerificationLevel.INSTITUTIONAL]: {
      label: 'Institutional',
      icon: 'shield-star',
      color: p.secondaryDark,
      bg: `${p.secondaryDark}24`,
    },
    [VerificationLevel.COMMUNITY]: {
      label: 'Community Trusted',
      icon: 'shield-crown',
      color: p.primary,
      bg: `${p.primary}1A`,
    },
  }

  const config = levelConfig[level]

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Icon source={config.icon} size={14} color={config.color} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      <Text style={[styles.score, { color: config.color }]}>{trustScore}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: { fontSize: 12, fontFamily: 'Outfit_700Bold' },
  score: { fontSize: 12, fontFamily: 'Outfit_700Bold', marginLeft: 2, opacity: 0.75 },
})
