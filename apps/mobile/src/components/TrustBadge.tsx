import { View, StyleSheet } from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { VerificationLevel } from '@ubuntu-fund/types'

interface TrustBadgeProps {
  level: VerificationLevel
  trustScore: number
}

const levelConfig: Record<
  VerificationLevel,
  { label: string; icon: string; color: string }
> = {
  [VerificationLevel.NONE]: {
    label: 'Unverified',
    icon: 'shield-outline',
    color: '#9E9E9E',
  },
  [VerificationLevel.EMAIL_PHONE]: {
    label: 'Basic',
    icon: 'shield-half-full',
    color: '#42A5F5',
  },
  [VerificationLevel.NATIONAL_ID]: {
    label: 'Verified',
    icon: 'shield-check',
    color: '#66BB6A',
  },
  [VerificationLevel.INSTITUTIONAL]: {
    label: 'Institutional',
    icon: 'shield-star',
    color: '#F9A825',
  },
  [VerificationLevel.COMMUNITY]: {
    label: 'Community Trusted',
    icon: 'shield-crown',
    color: '#AB47BC',
  },
}

export function TrustBadge({ level, trustScore }: TrustBadgeProps) {
  const config = levelConfig[level]

  return (
    <View style={[styles.badge, { borderColor: config.color }]}>
      <Icon source={config.icon} size={16} color={config.color} />
      <Text variant="labelSmall" style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
      <Text variant="labelSmall" style={[styles.score, { color: config.color }]}>
        {trustScore}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  label: { fontFamily: 'TTSquares-Bold' },
  score: { fontFamily: 'TTSquares-Bold', marginLeft: 2 },
})
