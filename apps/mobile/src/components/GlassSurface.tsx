import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import { BlurView } from 'expo-blur'
import { useColorMode } from '@/context/ColorModeContext'
import type { NeuRecipes } from '@/theme'

type SurfaceVariant = keyof NeuRecipes

// ---------------------------------------------------------------------------
// GlassSurface
//
// A themed surface for PRIMARY cards. For neumorphism / claymorphism / minimal
// it is just a <View> carrying the active recipe. For the glass skin it lays a
// real expo-blur BlurView behind the content (plus a translucent wash for
// legibility), which a flat translucent fill alone can't reproduce.
//
// Caller contract: pass LAYOUT-only style (padding / borderRadius / margin) —
// this component supplies the recipe/border/blur for the active skin. (Ordinary
// surfaces that just spread `neu.raised` into their own StyleSheet still get the
// glass skin's frosted-translucent recipe automatically via getNeu(); reach for
// GlassSurface only where you want the real backdrop blur.)
// ---------------------------------------------------------------------------

export function GlassSurface({
  variant = 'raised',
  style,
  children,
}: {
  variant?: SurfaceVariant
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}) {
  const { skin, neu, glass } = useColorMode()
  const recipe = neu[variant]

  if (skin !== 'glassmorphism') {
    return <View style={[recipe, style]}>{children}</View>
  }

  // Glass: the recipe supplies the translucent tint + hairline border; the
  // BlurView blurs whatever sits behind, and the overlay guarantees contrast.
  return (
    <View style={[recipe, style, styles.clip]}>
      <BlurView
        intensity={glass.intensity}
        tint={glass.tint}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: glass.overlay }]}
        pointerEvents="none"
      />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
})
