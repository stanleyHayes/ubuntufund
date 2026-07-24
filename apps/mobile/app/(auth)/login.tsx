import { useState } from 'react'
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native'
import { TextInput, Button, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link, router } from 'expo-router'
import { brandColors } from '@/theme'
import { useAuth } from '@/context/AuthContext'
import { UbuntuLogo } from '@/components/UbuntuLogo'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const insets = useSafeAreaInsets()

  const handleLogin = async () => {
    setError('')
    if (!email || !password) return
    setLoading(true)
    try {
      await login(email, password)
      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
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
          <UbuntuLogo size={56} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.lede}>Sign in to continue supporting communities across Africa</Text>
        </View>

        <View style={styles.card}>
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

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={secureEntry}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={secureEntry ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setSecureEntry(!secureEntry)}
              />
            }
            style={styles.input}
            outlineStyle={styles.inputOutline}
            outlineColor="rgba(26,46,34,0.10)"
            activeOutlineColor={brandColors.primary}
            disabled={loading}
          />

          <TouchableOpacity style={styles.forgotRow} onPress={() => router.push('/forgot-password')} hitSlop={8}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button
            mode="contained"
            onPress={handleLogin}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={brandColors.primary}
            disabled={!email || !password || loading}
            loading={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register">
              <Text style={styles.footerLink}>Sign Up</Text>
            </Link>
          </View>
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
    fontWeight: '700',
    fontFamily: 'TTSquares-Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#A07E33',
    marginTop: 16,
    marginBottom: 6,
  },
  title: { fontSize: 28, fontFamily: 'TTSquares-Black', color: brandColors.text, textAlign: 'center', marginBottom: 8 },
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
  errorBanner: {
    backgroundColor: 'rgba(165,67,47,0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: brandColors.error, fontSize: 13, fontFamily: 'Outfit_500Medium', textAlign: 'center' },

  input: { marginBottom: 14, backgroundColor: brandColors.surface },
  inputOutline: { borderRadius: 12 },

  forgotRow: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: brandColors.primary, fontFamily: 'Outfit_600SemiBold' },

  button: { borderRadius: 999, marginBottom: 24 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontFamily: 'TTSquares-Bold', letterSpacing: 0.3 },

  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },
  footerLink: { fontSize: 14, color: brandColors.primary, fontFamily: 'Outfit_600SemiBold' },
})
