import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { useMemo } from 'react'
import { usePalette } from '@/context/ColorModeContext'
import type { Palette } from '@/theme'

// Backend requires 8+ chars; the rest are strength boosters. We surface what's
// required and what's missing so the member always knows.
function rules(pw: string) {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8, required: true },
    { label: 'An uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'A lowercase letter', met: /[a-z]/.test(pw) },
    { label: 'A number', met: /\d/.test(pw) },
    { label: 'A symbol', met: /[^A-Za-z0-9]/.test(pw) },
  ]
}

const LEVELS = [
  { label: 'Too weak', color: '#A5432F' },
  { label: 'Weak', color: '#A5432F' },
  { label: 'Fair', color: '#C7A24A' },
  { label: 'Good', color: '#6B8E5A' },
  { label: 'Strong', color: '#2E3D2F' },
]

function score(pw: string): number {
  if (!pw) return 0
  let s = rules(pw).filter((r) => r.met).length
  if (pw.length >= 12 && s >= 3) s = Math.min(5, s + 1)
  return Math.max(1, Math.min(4, s - 1))
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
  if (!value) return null
  const filled = score(value)
  const level = LEVELS[Math.min(LEVELS.length - 1, filled)]
  return (
    <View style={styles.wrap}>
      <View style={styles.barRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.seg, i < filled && { backgroundColor: level.color }]} />
        ))}
      </View>
      <Text style={[styles.label, { color: level.color }]}>Password strength: {level.label}</Text>
      {rules(value).map((r) => (
        <View key={r.label} style={styles.ruleRow}>
          <Text style={{ fontSize: 12, color: r.met ? '#2E7D32' : r.required ? '#A5432F' : p.textSecondary }}>{r.met ? '✓' : '○'}</Text>
          <Text style={[styles.ruleText, { color: r.met ? p.textSecondary : r.required ? '#A5432F' : p.textSecondary }]}>
            {r.label}{r.required && !r.met ? ' (required)' : ''}
          </Text>
        </View>
      ))}
    </View>
  )
}
