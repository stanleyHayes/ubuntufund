import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { useMemo } from 'react'
import { passwordRules, passwordScore, passwordLevel } from '@ubuntu-fund/types'
import { usePalette } from '@/context/ColorModeContext'
import type { Palette } from '@/theme'

// One distinct colour per reachable tier, drawn from the active palette so the
// meter follows dark mode. These were hardcoded light-mode hexes, which put
// "Strong" at #2E3D2F on a #1E1E1E card — 1.4:1, effectively invisible.
function levelColors(p: Palette): Record<string, string> {
  return {
    Weak: p.error,
    Fair: p.warningText,
    Good: p.success,
    Strong: p.primary,
  }
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    wrap: { marginTop: 6, gap: 6 },
    barRow: { flexDirection: 'row', gap: 6 },
    seg: { flex: 1, height: 5, borderRadius: 999, backgroundColor: p.skeleton },
    label: { fontSize: 12, fontFamily: 'Outfit_700Bold' },
    ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ruleText: { fontSize: 12, fontFamily: 'Outfit_400Regular' },
  })
}

export function PasswordStrength({ value }: { value: string }) {
  const p = usePalette()
  const styles = useMemo(() => makeStyles(p), [p])
  const colors = useMemo(() => levelColors(p), [p])
  if (!value) return null
  const rules = passwordRules(value)
  const filled = passwordScore(value, rules)
  const level = passwordLevel(filled)
  const color = colors[level]
  return (
    <View style={styles.wrap}>
      <View style={styles.barRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.seg, i < filled && { backgroundColor: color }]} />
        ))}
      </View>
      <Text style={[styles.label, { color }]}>Password strength: {level}</Text>
      {rules.map((r) => {
        const missing = !r.met && Boolean(r.required)
        const ruleColor = r.met ? p.success : missing ? p.error : p.textSecondary
        return (
          <View key={r.label} style={styles.ruleRow}>
            <Text style={{ fontSize: 12, color: ruleColor }}>{r.met ? '✓' : '○'}</Text>
            <Text style={[styles.ruleText, { color: r.met ? p.textSecondary : ruleColor }]}>
              {r.label}
              {missing ? ' (required)' : ''}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
