import { useState } from 'react'
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
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
    <View style={{ gap: 12 }}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      <TextInput mode="outlined" label="Full Name" value={fullName} onChangeText={setFullName} style={styles.input} />
      <TextInput mode="outlined" label="Date of Birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth} style={styles.input} />
      <TextInput mode="outlined" label="Nationality" value={nationality} onChangeText={setNationality} style={styles.input} />
      <TextInput mode="outlined" label="ID Number" value={idNumber} onChangeText={setIdNumber} style={styles.input} />
      <Button mode="contained" onPress={onNext} style={styles.button}>Next</Button>
    </View>
  )
}

function DocumentStep({ onNext, onBack }: StepProps) {
  const [idFront, setIdFront] = useState('')
  const [idBack, setIdBack] = useState('')

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.stepTitle}>ID Document</Text>
      <Text style={styles.stepDesc}>Upload front and back of your ID</Text>
      <TextInput mode="outlined" label="Front URL" value={idFront} onChangeText={setIdFront} style={styles.input} />
      <TextInput mode="outlined" label="Back URL" value={idBack} onChangeText={setIdBack} style={styles.input} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {onBack && <Button mode="outlined" onPress={onBack} style={[styles.button, { flex: 1 }]}>Back</Button>}
        <Button mode="contained" onPress={onNext} style={[styles.button, { flex: 1 }]}>Next</Button>
      </View>
    </View>
  )
}

function AddressStep({ onNext, onBack }: StepProps) {
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.stepTitle}>Address Verification</Text>
      <TextInput mode="outlined" label="Street" value={street} onChangeText={setStreet} style={styles.input} />
      <TextInput mode="outlined" label="City" value={city} onChangeText={setCity} style={styles.input} />
      <TextInput mode="outlined" label="Country" value={country} onChangeText={setCountry} style={styles.input} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {onBack && <Button mode="outlined" onPress={onBack} style={[styles.button, { flex: 1 }]}>Back</Button>}
        <Button mode="contained" onPress={onNext} style={[styles.button, { flex: 1 }]}>Next</Button>
      </View>
    </View>
  )
}

function SelfieStep({ onBack, onSubmit }: StepProps & { onSubmit: () => void }) {
  const [selfie, setSelfie] = useState('')

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.stepTitle}>Selfie Verification</Text>
      <Text style={styles.stepDesc}>Upload a selfie holding your ID</Text>
      <TextInput mode="outlined" label="Selfie URL" value={selfie} onChangeText={setSelfie} style={styles.input} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {onBack && <Button mode="outlined" onPress={onBack} style={[styles.button, { flex: 1 }]}>Back</Button>}
        <Button mode="contained" onPress={onSubmit} style={[styles.button, { flex: 1 }]}>Submit</Button>
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Icon source="check-circle" size={64} color="#4CAF50" />
          <Text style={{ fontSize: 20, fontFamily: 'TTSquares-Bold', marginTop: 16, textAlign: 'center' }}>
            Verification Submitted!
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'TTSquares-Regular', color: '#666', marginTop: 8, textAlign: 'center' }}>
            Your documents are under review. We'll notify you once complete.
          </Text>
          <Button mode="contained" onPress={() => router.push('/dashboard')} style={{ marginTop: 24 }}>
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
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
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
        <View style={{ marginTop: 24 }}>
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
  container: { flex: 1, backgroundColor: '#F8F8F4' },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: brandColors.primary },
  stepDotText: { fontSize: 12, fontFamily: 'TTSquares-Bold', color: '#666' },
  stepDotTextActive: { color: '#fff' },
  stepLabel: { fontSize: 11, fontFamily: 'TTSquares-Regular', color: '#999', marginTop: 4 },
  stepLabelActive: { color: brandColors.primary, fontWeight: '700' },
  stepLine: { position: 'absolute', top: 14, right: '-50%', width: '100%', height: 2, backgroundColor: '#E0E0E0', zIndex: -1 },
  stepLineActive: { backgroundColor: brandColors.primary },
  stepTitle: { fontSize: 18, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 4 },
  stepDesc: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#666', marginBottom: 8 },
  input: { backgroundColor: '#fff' },
  button: { borderRadius: 8, marginTop: 8 },
})
