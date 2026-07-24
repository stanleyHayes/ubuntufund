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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Forest brand stage — mirrors the web AuthLayout panel */}
        <View style={[styles.stage, { paddingTop: insets.top + 48 }]}>
          <UbuntuLogo size={52} />
          <Text style={styles.stageTitle}>
            Together, <Text style={styles.stageTitleAccent}>We Rise</Text>
          </Text>
          <Text style={styles.stageCaption}>One chain · Many hands · Ubuntu</Text>
        </View>

        {/* Parchment sheet */}
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.grabber} />
          <Text style={styles.eyebrow}>Welcome back</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.lede}>Continue supporting the causes you care about.</Text>

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
            outlineColor="rgba(26,46,34,0.14)"
            activeOutlineColor={brandColors.primary}
            disabled={loading}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={secureEntry}
            autoComplete="current-password"
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={secureEntry ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setSecureEntry(!secureEntry)}
                forceTextInputFocus={false}
              />
            }
            style={styles.input}
            outlineStyle={styles.inputOutline}
            outlineColor="rgba(26,46,34,0.14)"
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
            textColor="#F5F2EA"
            disabled={!email || !password || loading}
            loading={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register">
              <Text style={styles.footerLink}>Create one</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.primaryDark },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, backgroundColor: brandColors.primaryDark },

  stage: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 44,
    backgroundColor: brandColors.primaryDark,
  },
  stageTitle: {
    marginTop: 22,
    fontSize: 26,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#F5F2EA',
    textAlign: 'center',
  },
  stageTitleAccent: { color: '#DCC07E', fontFamily: 'Outfit_800ExtraBold' },
  stageCaption: {
    marginTop: 10,
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: 'rgba(245,242,234,0.5)',
  },

  sheet: {
    flexGrow: 1,
    backgroundColor: brandColors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26,46,34,0.14)',
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#A07E33',
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Outfit_800ExtraBold',
    color: brandColors.text,
    marginBottom: 6,
  },
  lede: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: brandColors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
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

  forgotRow: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -2 },
  forgotText: { fontSize: 13, color: brandColors.primary, fontFamily: 'Outfit_600SemiBold' },

  button: { borderRadius: 999, marginBottom: 22 },
  buttonContent: { paddingVertical: 7 },
  buttonLabel: { fontSize: 16, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },

  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },
  footerLink: { fontSize: 14, color: brandColors.primary, fontFamily: 'Outfit_600SemiBold' },
})
