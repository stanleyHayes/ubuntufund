import type { ReactNode } from 'react'
import { View, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native'
import { Text } from 'react-native-paper'
import { useColorMode } from '@/context/ColorModeContext'

/** Informational label that grows with its text, including larger accessibility fonts. */
export function Chip({ children, style, textStyle, compact = false }: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  compact?: boolean
}) {
  const { palette: p, neu, skin } = useColorMode()
  return <View style={[neu.subtle, styles.container, { paddingHorizontal: compact ? 10 : 12 }, style, { borderRadius: skin === 'claymorphism' ? 14 : skin === 'minimal' ? 6 : 10 }]}>
    <Text style={[styles.label, { color: p.text }, textStyle, { marginVertical: 0, flexShrink: 1 }]}>{children}</Text>
  </View>
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 32, borderRadius: 10, paddingVertical: 6, justifyContent: 'center' },
  label: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, lineHeight: 18 },
})
