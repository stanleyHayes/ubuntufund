import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { useState, useMemo } from 'react'
import { View, StyleSheet, Platform, KeyboardAvoidingView, ScrollView } from 'react-native'
import { Button, Text, Icon } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { UjimoraLogo } from '@/components/UjimoraLogo'
import { api } from '@/lib/api'

export default function ForgotPasswordScreen() {
  const p = usePalette()
  const styles = useStyles()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const insets = useSafeAreaInsets()

  const handleSubmit = async () => {
    setError('')
    if (!email) return
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      // Show success even on failure to not reveal if email exists
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <UjimoraLogo size={48} />
          <Text style={styles.eyebrow}>Password Reset</Text>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.lede}>
            {sent
              ? 'Check your email for a reset link'
              : "Enter your email and we'll send you a password reset link"}
          </Text>
        </View>

        <View style={styles.card}>
          {sent ? (
            <View style={styles.successBox}>
              <View style={styles.iconTile}>
                <Icon source="check-circle" size={28} color={p.success} />
              </View>
              <Text style={styles.successTitle}>Email sent</Text>
              <Text style={styles.successBody}>
                If an account exists for {email}, you'll receive a password reset link shortly.
              </Text>
              <Button
                mode="contained"
                onPress={() => router.back()}
                style={styles.button}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor={p.secondary}
                textColor="#221B0E"
              >
                Back to Sign In
              </Button>
            </View>
          ) : (
            <>
              {!!error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TextInput
                label="Email address"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                left={<TextInput.Icon icon="email-outline" />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                outlineColor={p.border}
                activeOutlineColor={p.primary}
                disabled={loading}
              />

              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.button}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor={p.primary}
                disabled={!email || loading}
                loading={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <Button
                mode="text"
                onPress={() => router.back()}
                labelStyle={styles.backLabel}
              >
                Back to Sign In
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },

    header: { alignItems: 'center', marginBottom: 28 },
    eyebrow: {
      fontSize: 11,
      fontFamily: 'Outfit_700Bold',
      textTransform: 'uppercase',
      letterSpacing: 2,
      color: p.secondaryDark,
      marginTop: 14,
      marginBottom: 6,
    },
    title: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: p.text, textAlign: 'center', marginBottom: 8 },
    lede: {
      fontSize: 14,
      fontFamily: 'Outfit_400Regular',
      color: p.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 12,
    },

    card: {
      ...neu.raised,
      backgroundColor: p.surface,
      borderRadius: 14,
      padding: 24,
    },
    errorBanner: { backgroundColor: `${p.error}1A`, borderRadius: 10, padding: 12, marginBottom: 16 },
    errorText: { color: p.error, fontSize: 13, fontFamily: 'Outfit_700Bold', textAlign: 'center' },
    input: { marginBottom: 20, backgroundColor: p.surface },
    inputOutline: { borderRadius: 12 },
    button: { borderRadius: 999, marginBottom: 12 },
    buttonContent: { paddingVertical: 6 },
    buttonLabel: { fontSize: 16, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },
    backLabel: { color: p.textSecondary, fontSize: 14, fontFamily: 'Outfit_400Regular' },

    successBox: { alignItems: 'center', paddingVertical: 8 },
    iconTile: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(168,181,160,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    successTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 8 },
    successBody: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: p.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}
