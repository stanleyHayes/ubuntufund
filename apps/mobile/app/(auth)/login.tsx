import { useState, useEffect, useRef } from 'react'
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { TextInput, Button, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link, router } from 'expo-router'
import { brandColors } from '@/theme'
import { useAuth } from '@/context/AuthContext'
import { UbuntuLogo } from '@/components/UbuntuLogo'

const { width } = Dimensions.get('window')

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()

  // Animations
  const logoScale = useRef(new Animated.Value(0.5)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const titleOpacity = useRef(new Animated.Value(0)).current
  const titleTranslate = useRef(new Animated.Value(15)).current
  const cardTranslate = useRef(new Animated.Value(40)).current
  const cardOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(titleTranslate, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardTranslate, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
      ]),
    ]).start()
  }, [])

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hero — fills remaining space above the form */}
      <View style={styles.hero}>
        <View style={[styles.bgCircle, styles.circleTopRight]} />
        <View style={[styles.bgCircle, styles.circleBottomLeft]} />

        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <UbuntuLogo size={80} />
        </Animated.View>

        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslate }], marginTop: 20 }}>
          <Text style={styles.heroTitle}>Welcome Back</Text>
          <Text style={styles.heroSubtitle}>
            Sign in to continue supporting{'\n'}communities across Africa
          </Text>
        </Animated.View>
      </View>

      {/* Form card */}
      <Animated.View style={[styles.cardWrapper, { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
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
                disabled={loading}
              />

              <TouchableOpacity style={styles.forgotRow} onPress={() => router.push('/forgot-password')}>
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
      </Animated.View>
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
  circleTopRight: {
    width: width * 0.8,
    height: width * 0.8,
    top: -width * 0.3,
    right: -width * 0.25,
  },
  circleBottomLeft: {
    width: width * 0.5,
    height: width * 0.5,
    bottom: -width * 0.1,
    left: -width * 0.15,
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: 'TTSquares-Black',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    fontFamily: 'TTSquares-Regular',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 22,
  },
  cardWrapper: {},
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
  errorBanner: {
    backgroundColor: 'rgba(211,47,47,0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#D32F2F', fontSize: 13, fontFamily: 'TTSquares-Bold', textAlign: 'center' },
  input: { marginBottom: 14, backgroundColor: '#FAFAFA' },
  inputOutline: { borderRadius: 12, borderColor: 'rgba(0,0,0,0.08)' },
  forgotRow: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: brandColors.primary, fontFamily: 'TTSquares-Bold' },
  button: { borderRadius: 12, marginBottom: 24 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontFamily: 'TTSquares-Bold', letterSpacing: 0.3 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 14, fontFamily: 'TTSquares-Regular', color: '#757575' },
  footerLink: { fontSize: 14, color: brandColors.primary, fontFamily: 'TTSquares-Bold' },
})
