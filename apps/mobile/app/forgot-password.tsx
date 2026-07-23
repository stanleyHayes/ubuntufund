import { useState } from 'react'
import { View, StyleSheet, Platform, Dimensions } from 'react-native'
import { TextInput, Button, Text, Icon } from 'react-native-paper'
import { router } from 'expo-router'
import { brandColors } from '@/theme'
import { UbuntuLogo } from '@/components/UbuntuLogo'
import { api } from '@/lib/api'

const { width } = Dimensions.get('window')

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

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
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={[styles.bgCircle, styles.circleTop]} />
        <UbuntuLogo size={64} />
        <Text style={styles.heroTitle}>Reset Password</Text>
        <Text style={styles.heroSubtitle}>
          {sent
            ? 'Check your email for a reset link'
            : "Enter your email and we'll send\nyou a password reset link"}
        </Text>
      </View>

      <View style={styles.card}>
        {sent ? (
          <View style={styles.successBox}>
            <Icon source="check-circle" size={40} color={brandColors.primary} />
            <Text style={styles.successTitle}>Email Sent</Text>
            <Text style={styles.successBody}>
              If an account exists for {email}, you'll receive a password reset link shortly.
            </Text>
            <Button
              mode="contained"
              onPress={() => router.back()}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={brandColors.primary}
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1A0D' },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: brandColors.primary,
    opacity: 0.07,
  },
  circleTop: {
    width: width * 0.6,
    height: width * 0.6,
    top: -width * 0.2,
    right: -width * 0.1,
  },
  heroTitle: { fontSize: 26, fontFamily: 'TTSquares-Black', color: '#FFFFFF', marginTop: 20, marginBottom: 8 },
  heroSubtitle: { fontSize: 14, fontFamily: 'TTSquares-Regular', color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 21 },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  errorBanner: { backgroundColor: 'rgba(211,47,47,0.08)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#D32F2F', fontSize: 13, fontFamily: 'TTSquares-Bold', textAlign: 'center' },
  input: { marginBottom: 20, backgroundColor: '#FAFAFA' },
  inputOutline: { borderRadius: 12, borderColor: 'rgba(0,0,0,0.08)' },
  button: { borderRadius: 12, marginBottom: 12 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontFamily: 'TTSquares-Bold', letterSpacing: 0.3 },
  backLabel: { color: '#757575', fontSize: 14, fontFamily: 'TTSquares-Regular' },
  successBox: { alignItems: 'center', paddingVertical: 8 },
  successIcon: { fontSize: 40, color: brandColors.primary, marginBottom: 12 },
  successTitle: { fontSize: 20, fontFamily: 'TTSquares-Black', marginBottom: 8 },
  successBody: { fontSize: 14, fontFamily: 'TTSquares-Regular', color: '#757575', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
})
