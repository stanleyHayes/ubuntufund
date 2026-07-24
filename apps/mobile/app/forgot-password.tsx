import { useState } from 'react'
import { View, StyleSheet, Platform, KeyboardAvoidingView, ScrollView } from 'react-native'
import { TextInput, Button, Text, Icon } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { brandColors } from '@/theme'
import { UbuntuLogo } from '@/components/UbuntuLogo'
import { api } from '@/lib/api'

export default function ForgotPasswordScreen() {
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
          <UbuntuLogo size={48} />
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
                <Icon source="check-circle" size={28} color={brandColors.success} />
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
                buttonColor={brandColors.secondary}
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
                outlineColor="rgba(26,46,34,0.10)"
                activeOutlineColor={brandColors.primary}
                disabled={loading}
              />

              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.button}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor={brandColors.primary}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },

  header: { alignItems: 'center', marginBottom: 28 },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#A07E33',
    marginTop: 14,
    marginBottom: 6,
  },
  title: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: brandColors.text, textAlign: 'center', marginBottom: 8 },
  lede: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: brandColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },

  card: {
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    padding: 24,
  },
  errorBanner: { backgroundColor: 'rgba(165,67,47,0.08)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: brandColors.error, fontSize: 13, fontFamily: 'Outfit_700Bold', textAlign: 'center' },
  input: { marginBottom: 20, backgroundColor: brandColors.surface },
  inputOutline: { borderRadius: 12 },
  button: { borderRadius: 999, marginBottom: 12 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },
  backLabel: { color: brandColors.textSecondary, fontSize: 14, fontFamily: 'Outfit_400Regular' },

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
  successTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: brandColors.text, marginBottom: 8 },
  successBody: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
})
