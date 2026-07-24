import { View, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { Text, Icon, Button } from 'react-native-paper'
import { brandColors } from '@/theme'

interface EmptyStateProps {
  /** MaterialCommunityIcons name for the tinted tile. */
  icon: string
  title: string
  subtitle?: string
  /** `error` swaps the sage tile for a clay-tinted one. */
  variant?: 'default' | 'error'
  /** When provided, renders a primary CTA below the copy. */
  ctaLabel?: string
  onCtaPress?: () => void
  ctaIcon?: string
  ctaColor?: string
  ctaTextColor?: string
  style?: StyleProp<ViewStyle>
}

/**
 * The one house empty-state: a centered tinted icon tile, a bold title, a
 * muted subtitle, and an optional primary CTA. Every empty/absent/error view
 * in the app should render through this so they all read as siblings.
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  variant = 'default',
  ctaLabel,
  onCtaPress,
  ctaIcon,
  ctaColor = brandColors.primary,
  ctaTextColor = '#FFFFFF',
  style,
}: EmptyStateProps) {
  const isError = variant === 'error'
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconTile, isError && styles.iconTileError]}>
        <Icon source={icon} size={24} color={isError ? brandColors.error : brandColors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <Button
          mode="contained"
          buttonColor={ctaColor}
          textColor={ctaTextColor}
          icon={ctaIcon}
          onPress={onCtaPress}
          style={styles.cta}
          labelStyle={styles.ctaLabel}
        >
          {ctaLabel}
        </Button>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 72, paddingHorizontal: 32 },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168,181,160,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconTileError: { backgroundColor: 'rgba(165,67,47,0.14)' },
  title: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: brandColors.text, textAlign: 'center' },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: brandColors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  cta: { marginTop: 16, borderRadius: 999 },
  ctaLabel: { fontFamily: 'Outfit_700Bold' },
})
