import { useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { Text, Icon, Button, TextInput } from 'react-native-paper'
import { Stack, useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { brandColors } from '@/theme'

interface StepProps {
  onNext?: () => void
  onBack?: () => void
}

function PersonalInfoStep({ onNext }: StepProps) {
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [nationality, setNationality] = useState('')
  const [idNumber, setIdNumber] = useState('')

  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      <TextInput mode="outlined" label="Full Name" value={fullName} onChangeText={setFullName} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <TextInput mode="outlined" label="Date of Birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <TextInput mode="outlined" label="Nationality" value={nationality} onChangeText={setNationality} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <TextInput mode="outlined" label="ID Number" value={idNumber} onChangeText={setIdNumber} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <Button mode="contained" onPress={onNext} style={styles.button} contentStyle={styles.buttonContent} labelStyle={styles.buttonLabel} buttonColor={brandColors.primary}>
        Next
      </Button>
    </View>
  )
}

function DocumentStep({ onNext, onBack }: StepProps) {
  const [idFront, setIdFront] = useState('')
  const [idBack, setIdBack] = useState('')

  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepTitle}>ID Document</Text>
      <Text style={styles.stepDesc}>Upload front and back of your ID</Text>
      <TextInput mode="outlined" label="Front URL" value={idFront} onChangeText={setIdFront} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <TextInput mode="outlined" label="Back URL" value={idBack} onChangeText={setIdBack} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <View style={styles.buttonRow}>
        {onBack && <Button mode="outlined" onPress={onBack} style={[styles.button, styles.buttonFlex]} contentStyle={styles.buttonContent} labelStyle={styles.buttonLabelSecondary} textColor={brandColors.primary}>Back</Button>}
        <Button mode="contained" onPress={onNext} style={[styles.button, styles.buttonFlex]} contentStyle={styles.buttonContent} labelStyle={styles.buttonLabel} buttonColor={brandColors.primary}>Next</Button>
      </View>
    </View>
  )
}

function AddressStep({ onNext, onBack }: StepProps) {
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')

  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepTitle}>Address Verification</Text>
      <TextInput mode="outlined" label="Street" value={street} onChangeText={setStreet} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <TextInput mode="outlined" label="City" value={city} onChangeText={setCity} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <TextInput mode="outlined" label="Country" value={country} onChangeText={setCountry} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <View style={styles.buttonRow}>
        {onBack && <Button mode="outlined" onPress={onBack} style={[styles.button, styles.buttonFlex]} contentStyle={styles.buttonContent} labelStyle={styles.buttonLabelSecondary} textColor={brandColors.primary}>Back</Button>}
        <Button mode="contained" onPress={onNext} style={[styles.button, styles.buttonFlex]} contentStyle={styles.buttonContent} labelStyle={styles.buttonLabel} buttonColor={brandColors.primary}>Next</Button>
      </View>
    </View>
  )
}

function SelfieStep({ onBack, onSubmit }: StepProps & { onSubmit: () => void }) {
  const [selfie, setSelfie] = useState('')

  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepTitle}>Selfie Verification</Text>
      <Text style={styles.stepDesc}>Upload a selfie holding your ID</Text>
      <TextInput mode="outlined" label="Selfie URL" value={selfie} onChangeText={setSelfie} style={styles.input} outlineStyle={styles.inputOutline} outlineColor="rgba(26,46,34,0.10)" activeOutlineColor={brandColors.primary} />
      <View style={styles.buttonRow}>
        {onBack && <Button mode="outlined" onPress={onBack} style={[styles.button, styles.buttonFlex]} contentStyle={styles.buttonContent} labelStyle={styles.buttonLabelSecondary} textColor={brandColors.primary}>Back</Button>}
        <Button mode="contained" onPress={onSubmit} style={[styles.button, styles.buttonFlex]} contentStyle={styles.buttonContent} labelStyle={styles.buttonLabel} buttonColor={brandColors.primary}>Submit</Button>
      </View>
    </View>
  )
}

export default function KYCScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const steps = ['Personal', 'ID Doc', 'Address', 'Selfie']

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await api.post('/kyc/identity', {
        personalInfo: { fullName: '', nationality: '' },
        documents: [{ type: 'id_card', url: 'https://example.com/doc.pdf' }],
      })
      setSubmitted(true)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'KYC Submitted', headerStyle: { backgroundColor: brandColors.primary } }} />
        <View style={styles.successWrap}>
          <View style={styles.iconTile}>
            <Icon source="check-circle" size={28} color={brandColors.success} />
          </View>
          <Text style={styles.successTitle}>Verification submitted</Text>
          <Text style={styles.successBody}>
            Your documents are under review. We'll notify you once complete.
          </Text>
          <Button
            mode="contained"
            onPress={() => router.push('/dashboard')}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={brandColors.secondary}
            textColor="#221B0E"
          >
            Go to Dashboard
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'KYC Verification',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Progress */}
        <View style={styles.progressRow}>
          {steps.map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, i <= step && styles.stepDotTextActive]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{s}</Text>
              {i < steps.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineActive]} />}
            </View>
          ))}
        </View>

        {/* Step content */}
        <View style={styles.stepContentWrap}>
          {step === 0 && <PersonalInfoStep onNext={() => setStep(1)} />}
          {step === 1 && <DocumentStep onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <AddressStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <SelfieStep onBack={() => setStep(2)} onSubmit={handleSubmit} />}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  scrollContent: { padding: 16, paddingBottom: 32 },

  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(168,181,160,0.28)', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: brandColors.primary },
  stepDotText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: brandColors.textSecondary },
  stepDotTextActive: { color: '#FFFFFF' },
  stepLabel: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 4 },
  stepLabelActive: { color: brandColors.primary, fontFamily: 'Outfit_700Bold' },
  stepLine: { position: 'absolute', top: 14, right: '-50%', width: '100%', height: 2, backgroundColor: 'rgba(168,181,160,0.28)', zIndex: -1 },
  stepLineActive: { backgroundColor: brandColors.primary },

  stepContentWrap: { marginTop: 24 },
  stepCard: {
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    padding: 20,
    gap: 12,
  },
  stepTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: brandColors.text, marginBottom: 4 },
  stepDesc: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginBottom: 8 },

  input: { backgroundColor: brandColors.surface },
  inputOutline: { borderRadius: 12 },

  buttonRow: { flexDirection: 'row', gap: 12 },
  button: { borderRadius: 999, marginTop: 8 },
  buttonFlex: { flex: 1 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 15, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },
  buttonLabelSecondary: { fontSize: 15, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },

  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(168,181,160,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: brandColors.text, textAlign: 'center' },
  successBody: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
})
