import { Button } from '@/components/Loading'
import { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { usePalette } from '@/context/ColorModeContext'
import type { Palette } from '@/theme'

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

function makeStyles(p: Palette) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 24, borderRadius: 20, backgroundColor: 'rgba(168,181,160,0.10)' },
    iconTile: {
      width: 64,
      height: 64,
      borderTopLeftRadius: 10, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 10,
      backgroundColor: 'rgba(168,181,160,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    iconTileError: { backgroundColor: `${p.error}24` },
    title: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text, textAlign: 'center' },
    subtitle: {
      fontSize: 13,
      fontFamily: 'Outfit_400Regular',
      color: p.textSecondary,
      marginTop: 6,
      textAlign: 'center',
      lineHeight: 18,
    },
    cta: { marginTop: 16, borderRadius: 999 },
    ctaLabel: { fontFamily: 'Outfit_700Bold' },
  })
}

function useStyles() {
  const p = usePalette()
  return useMemo(() => makeStyles(p), [p])
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
  ctaColor,
  ctaTextColor = '#FFFFFF',
  style,
}: EmptyStateProps) {
  const p = usePalette()
  const styles = useStyles()
  const isError = variant === 'error'
  const tint = ctaColor ?? p.primary
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconTile, isError && styles.iconTileError]}>
        <Icon source={icon} size={28} color={isError ? p.error : p.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <Button
          mode="contained"
          buttonColor={tint}
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
