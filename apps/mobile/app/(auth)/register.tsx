import { useState } from 'react'
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { TextInput, Button, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link, router } from 'expo-router'
import { brandColors } from '@/theme'
import { OrganizationType } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { UbuntuLogo } from '@/components/UbuntuLogo'

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
  const [secureEntry, setSecureEntry] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState<OrganizationType>(OrganizationType.NGO)
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [showOrgTypePicker, setShowOrgTypePicker] = useState(false)

  const { register } = useAuth()
  const insets = useSafeAreaInsets()

  const handleRegister = async () => {
    setError('')
    const payload: Record<string, string> = { name, email, password, country: 'Ghana' }
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Forest brand stage — mirrors the web AuthLayout panel */}
        <View style={[styles.stage, { paddingTop: insets.top + 36 }]}>
          <UbuntuLogo size={44} />
          <Text style={styles.stageTitle}>
            Together, <Text style={styles.stageTitleAccent}>We Rise</Text>
          </Text>
          <Text style={styles.stageCaption}>One chain · Many hands · Ubuntu</Text>
        </View>

        {/* Parchment sheet */}
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.grabber} />
          <Text style={styles.eyebrow}>Get started</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.lede}>Back causes and communities across Ghana.</Text>

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

          <Text style={styles.sectionLabel}>Personal information</Text>

          <TextInput
            label="Full name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            left={<TextInput.Icon icon="account-outline" />}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            outlineColor="rgba(26,46,34,0.14)"
            activeOutlineColor={brandColors.primary}
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
            outlineColor="rgba(26,46,34,0.14)"
            activeOutlineColor={brandColors.primary}
            disabled={loading}
          />

          {/* Organization fields */}
          {accountType === 'organization' && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Organization details</Text>

              <TextInput
                label="Organization name"
                value={orgName}
                onChangeText={setOrgName}
                mode="outlined"
                left={<TextInput.Icon icon="domain" />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                outlineColor="rgba(26,46,34,0.14)"
                activeOutlineColor={brandColors.primary}
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
                  outlineColor="rgba(26,46,34,0.14)"
                  activeOutlineColor={brandColors.primary}
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
                outlineColor="rgba(26,46,34,0.14)"
                activeOutlineColor={brandColors.primary}
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
            autoComplete="new-password"
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

          {password.length > 0 && password.length < 8 && (
            <View style={styles.hintRow}>
              <View style={[styles.hintDot, { backgroundColor: brandColors.error }]} />
              <Text style={styles.hintText}>At least 8 characters required</Text>
            </View>
          )}
          {password.length >= 8 && (
            <View style={styles.hintRow}>
              <View style={[styles.hintDot, { backgroundColor: brandColors.success }]} />
              <Text style={[styles.hintText, { color: brandColors.success }]}>Strong password</Text>
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
            outlineColor="rgba(26,46,34,0.14)"
            activeOutlineColor={brandColors.primary}
            disabled={loading}
          />
          {!!confirmPassword && !passwordsMatch && (
            <View style={styles.hintRow}>
              <View style={[styles.hintDot, { backgroundColor: brandColors.error }]} />
              <Text style={[styles.hintText, { color: brandColors.error }]}>Passwords do not match</Text>
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleRegister}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={brandColors.primary}
            textColor="#F5F2EA"
            disabled={!canSubmit}
            loading={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>

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
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.primaryDark },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, backgroundColor: brandColors.primaryDark },

  stage: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 32,
    backgroundColor: brandColors.primaryDark,
  },
  stageTitle: {
    marginTop: 18,
    fontSize: 22,
    fontFamily: 'TTSquares-Black',
    color: '#F5F2EA',
    textAlign: 'center',
  },
  stageTitleAccent: { color: '#DCC07E', fontFamily: 'TTSquares-Black' },
  stageCaption: {
    marginTop: 8,
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
    fontSize: 24,
    fontFamily: 'TTSquares-Black',
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

  errorBanner: { backgroundColor: 'rgba(165,67,47,0.08)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: brandColors.error, fontSize: 13, fontFamily: 'Outfit_500Medium', textAlign: 'center' },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: brandColors.textSecondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  toggleRow: { flexDirection: 'row', backgroundColor: 'rgba(168,181,160,0.28)', borderRadius: 999, padding: 4, marginBottom: 24 },
  toggleButton: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 999 },
  toggleActive: { backgroundColor: brandColors.primary },
  toggleText: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: brandColors.text },
  toggleTextActive: { color: '#FFFFFF' },

  input: { marginBottom: 14, backgroundColor: brandColors.surface },
  inputOutline: { borderRadius: 12 },

  pickerDropdown: { backgroundColor: brandColors.surface, borderWidth: 1, borderColor: 'rgba(26,46,34,0.10)', borderRadius: 12, marginTop: -10, marginBottom: 14, overflow: 'hidden' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(26,46,34,0.06)' },
  pickerItemActive: { backgroundColor: 'rgba(168,181,160,0.28)' },
  pickerItemText: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: brandColors.text },
  pickerItemTextActive: { color: brandColors.text, fontFamily: 'Outfit_600SemiBold' },
  pickerCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: brandColors.primary },

  hintRow: { flexDirection: 'row', alignItems: 'center', marginTop: -8, marginBottom: 12, paddingLeft: 4 },
  hintDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  hintText: { fontSize: 12, color: brandColors.textSecondary, fontFamily: 'Outfit_400Regular' },

  button: { borderRadius: 999, marginTop: 8, marginBottom: 16 },
  buttonContent: { paddingVertical: 7 },
  buttonLabel: { fontSize: 16, fontFamily: 'TTSquares-Bold', letterSpacing: 0.3 },

  terms: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  termsLink: { color: brandColors.primary, fontFamily: 'Outfit_600SemiBold' },

  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },
  footerLink: { fontSize: 14, color: brandColors.primary, fontFamily: 'Outfit_600SemiBold' },
})
