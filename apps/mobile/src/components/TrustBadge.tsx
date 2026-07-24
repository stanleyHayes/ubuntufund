import { View, StyleSheet } from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { VerificationLevel } from '@ubuntu-fund/types'
import { brandColors } from '../theme'

interface TrustBadgeProps {
  level: VerificationLevel
  trustScore: number
}

const levelConfig: Record<
  VerificationLevel,
  { label: string; icon: string; color: string; bg: string }
> = {
  [VerificationLevel.NONE]: {
    label: 'Unverified',
    icon: 'shield-outline',
    color: brandColors.textSecondary,
    bg: 'rgba(74,90,80,0.10)',
  },
  [VerificationLevel.EMAIL_PHONE]: {
    label: 'Basic',
    icon: 'shield-half-full',
    color: brandColors.primaryLight,
    bg: 'rgba(94,143,114,0.14)',
  },
  [VerificationLevel.NATIONAL_ID]: {
    label: 'Verified',
    icon: 'shield-check',
    color: brandColors.success,
    bg: 'rgba(47,107,70,0.10)',
  },
  [VerificationLevel.INSTITUTIONAL]: {
    label: 'Institutional',
    icon: 'shield-star',
    color: brandColors.secondaryDark,
    bg: 'rgba(160,126,51,0.14)',
  },
  [VerificationLevel.COMMUNITY]: {
    label: 'Community Trusted',
    icon: 'shield-crown',
    color: brandColors.primary,
    bg: 'rgba(46,61,47,0.10)',
  },
}

export function TrustBadge({ level, trustScore }: TrustBadgeProps) {
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
  label: { fontSize: 12, fontFamily: 'TTSquares-Bold' },
  score: { fontSize: 12, fontFamily: 'TTSquares-Bold', marginLeft: 2, opacity: 0.75 },
})
