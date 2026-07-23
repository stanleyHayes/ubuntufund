import { useState, useEffect, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native'
import { TextInput, Button, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link, router } from 'expo-router'
import { brandColors } from '@/theme'
import { OrganizationType } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { UbuntuLogo } from '@/components/UbuntuLogo'

const { width } = Dimensions.get('window')

type AccountType = 'individual' | 'organization'

const ORG_TYPE_OPTIONS: { value: OrganizationType; label: string }[] = [
  { value: OrganizationType.NGO, label: 'NGO' },
  { value: OrganizationType.HOSPITAL, label: 'Hospital' },
  { value: OrganizationType.SCHOOL, label: 'School' },
  { value: OrganizationType.RELIGIOUS, label: 'Religious' },
  { value: OrganizationType.GOVERNMENT, label: 'Government' },
  { value: OrganizationType.OTHER, label: 'Other' },
]

export default function RegisterScreen() {
  const [accountType, setAccountType] = useState<AccountType>('individual')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [country, setCountry] = useState('')
  const [secureEntry, setSecureEntry] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState<OrganizationType>(OrganizationType.NGO)
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [showOrgTypePicker, setShowOrgTypePicker] = useState(false)

  const { register } = useAuth()

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

  const handleRegister = async () => {
    setError('')
    const payload: Record<string, string> = { name, email, password }
    if (country) payload.country = country
    if (accountType === 'organization') {
      payload.role = 'organization'
      payload.organizationName = orgName
      payload.organizationType = orgType
      if (registrationNumber) payload.registrationNumber = registrationNumber
    }

    setLoading(true)
    try {
      await register(payload as Parameters<typeof register>[0])
      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = password === confirmPassword
  const canSubmit =
    name &&
    email &&
    password.length >= 8 &&
    confirmPassword &&
    passwordsMatch &&
    !loading &&
    (accountType === 'individual' || orgName.trim().length > 0)

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={[styles.bgCircle, styles.circleTopLeft]} />
        <View style={[styles.bgCircle, styles.circleRight]} />

        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <UbuntuLogo size={72} />
        </Animated.View>

        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslate }], marginTop: 16 }}>
          <Text style={styles.heroTitle}>Join UbuntuFund</Text>
          <Text style={styles.heroSubtitle}>
            Create your account to start{'\n'}making an impact across Africa
          </Text>
        </Animated.View>
      </View>

      {/* Form card */}
      <Animated.View style={[styles.cardWrapper, { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.cardScroll}
          >
            <View style={styles.card}>
              {!!error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Account type toggle */}
              <View style={styles.toggleRow}>
                {(['individual', 'organization'] as const).map((type) => {
                  const active = accountType === type
                  return (
                    <Pressable
                      key={type}
                      style={[styles.toggleButton, active && styles.toggleActive]}
                      onPress={() => setAccountType(type)}
                    >
                      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                        {type === 'individual' ? 'Individual' : 'Organization'}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={styles.sectionLabel}>Personal Information</Text>

              <TextInput
                label="Full name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                left={<TextInput.Icon icon="account-outline" />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={loading}
              />
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
                label="Country"
                value={country}
                onChangeText={setCountry}
                mode="outlined"
                left={<TextInput.Icon icon="earth" />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={loading}
              />

              {/* Organization fields */}
              {accountType === 'organization' && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Organization Details</Text>

                  <TextInput
                    label="Organization name"
                    value={orgName}
                    onChangeText={setOrgName}
                    mode="outlined"
                    left={<TextInput.Icon icon="domain" />}
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                  />

                  <Pressable onPress={() => setShowOrgTypePicker(!showOrgTypePicker)}>
                    <TextInput
                      label="Organization type"
                      value={ORG_TYPE_OPTIONS.find((o) => o.value === orgType)?.label ?? ''}
                      mode="outlined"
                      left={<TextInput.Icon icon="tag-outline" />}
                      right={<TextInput.Icon icon={showOrgTypePicker ? 'chevron-up' : 'chevron-down'} onPress={() => setShowOrgTypePicker(!showOrgTypePicker)} />}
                      style={styles.input}
                      outlineStyle={styles.inputOutline}
                      editable={false}
                    />
                  </Pressable>

                  {showOrgTypePicker && (
                    <View style={styles.pickerDropdown}>
                      {ORG_TYPE_OPTIONS.map((option) => {
                        const active = orgType === option.value
                        return (
                          <Pressable
                            key={option.value}
                            style={[styles.pickerItem, active && styles.pickerItemActive]}
                            onPress={() => { setOrgType(option.value); setShowOrgTypePicker(false) }}
                          >
                            <Text style={[styles.pickerItemText, active && styles.pickerItemTextActive]}>
                              {option.label}
                            </Text>
                            {active && <View style={styles.pickerCheck} />}
                          </Pressable>
                        )
                      })}
                    </View>
                  )}

                  <TextInput
                    label="Registration number (optional)"
                    value={registrationNumber}
                    onChangeText={setRegistrationNumber}
                    mode="outlined"
                    left={<TextInput.Icon icon="file-document-outline" />}
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    disabled={loading}
                  />
                </>
              )}

              {/* Password */}
              <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Security</Text>

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry={secureEntry}
                left={<TextInput.Icon icon="lock-outline" />}
                right={<TextInput.Icon icon={secureEntry ? 'eye-off-outline' : 'eye-outline'} onPress={() => setSecureEntry(!secureEntry)} />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={loading}
              />

              {password.length > 0 && password.length < 8 && (
                <View style={styles.hintRow}>
                  <View style={[styles.hintDot, { backgroundColor: '#E53935' }]} />
                  <Text style={styles.hintText}>At least 8 characters required</Text>
                </View>
              )}
              {password.length >= 8 && (
                <View style={styles.hintRow}>
                  <View style={[styles.hintDot, { backgroundColor: brandColors.primary }]} />
                  <Text style={[styles.hintText, { color: brandColors.primary }]}>Strong password</Text>
                </View>
              )}

              <TextInput
                label="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                mode="outlined"
                secureTextEntry
                left={<TextInput.Icon icon="lock-check-outline" />}
                error={!!confirmPassword && !passwordsMatch}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={loading}
              />
              {!!confirmPassword && !passwordsMatch && (
                <View style={styles.hintRow}>
                  <View style={[styles.hintDot, { backgroundColor: '#E53935' }]} />
                  <Text style={[styles.hintText, { color: '#E53935' }]}>Passwords do not match</Text>
                </View>
              )}

              <Button
                mode="contained"
                onPress={handleRegister}
                style={styles.button}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor={brandColors.primary}
                disabled={!canSubmit}
                loading={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>

              {/* Terms notice with working links */}
              <Text style={styles.terms}>
                By creating an account, you agree to our{' '}
                <Text style={styles.termsLink} onPress={() => router.push('/terms')}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.termsLink} onPress={() => router.push('/privacy')}>Privacy Policy</Text>
              </Text>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/(auth)/login">
                  <Text style={styles.footerLink}>Sign In</Text>
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
    minHeight: 180,
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: brandColors.primary,
    opacity: 0.07,
  },
  circleTopLeft: { width: width * 0.7, height: width * 0.7, top: -width * 0.25, left: -width * 0.2 },
  circleRight: { width: width * 0.4, height: width * 0.4, bottom: 0, right: -width * 0.1 },
  heroTitle: { fontSize: 26, fontFamily: 'TTSquares-Black', color: '#FFFFFF', textAlign: 'center', marginBottom: 6 },
  heroSubtitle: { fontSize: 14, fontFamily: 'TTSquares-Regular', color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 21 },

  cardWrapper: { maxHeight: '70%' },
  cardScroll: {},
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  errorBanner: { backgroundColor: 'rgba(211,47,47,0.08)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#D32F2F', fontSize: 13, fontFamily: 'TTSquares-Bold', textAlign: 'center' },
  sectionLabel: { fontSize: 11, fontFamily: 'TTSquares-Bold', color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },

  toggleRow: { flexDirection: 'row', backgroundColor: '#F5F5F0', borderRadius: 12, padding: 4, marginBottom: 24 },
  toggleButton: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 9 },
  toggleActive: { backgroundColor: brandColors.primary, shadowColor: brandColors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  toggleText: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#757575' },
  toggleTextActive: { color: '#FFFFFF' },

  input: { marginBottom: 14, backgroundColor: '#FAFAFA' },
  inputOutline: { borderRadius: 12, borderColor: 'rgba(0,0,0,0.08)' },

  pickerDropdown: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 12, marginTop: -10, marginBottom: 14, overflow: 'hidden' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  pickerItemActive: { backgroundColor: 'rgba(46,125,50,0.06)' },
  pickerItemText: { fontSize: 14, fontFamily: 'TTSquares-Regular', color: '#424242' },
  pickerItemTextActive: { color: brandColors.primary, fontFamily: 'TTSquares-Bold' },
  pickerCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: brandColors.primary },

  hintRow: { flexDirection: 'row', alignItems: 'center', marginTop: -8, marginBottom: 12, paddingLeft: 4 },
  hintDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  hintText: { fontSize: 12, color: '#999', fontFamily: 'TTSquares-Regular' },

  button: { borderRadius: 12, marginTop: 8, marginBottom: 16 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontFamily: 'TTSquares-Bold', letterSpacing: 0.3 },

  terms: { fontSize: 12, fontFamily: 'TTSquares-Regular', color: '#999', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  termsLink: { color: brandColors.primary, fontFamily: 'TTSquares-Bold' },

  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 14, fontFamily: 'TTSquares-Regular', color: '#757575' },
  footerLink: { fontSize: 14, color: brandColors.primary, fontFamily: 'TTSquares-Bold' },
})
