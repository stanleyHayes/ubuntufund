import { useAuth } from '@/context/AuthContext'
import { SignInRequired } from '@/components/SignInRequired'
import { useState } from 'react'
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { Text, Snackbar, ProgressBar } from 'react-native-paper'
import { Stack, router } from 'expo-router'
import { Country, State, City } from 'country-state-city'
import * as Location from 'expo-location'
import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { BrandedDateField } from '@/components/BrandedDateField'
import { SelectionField } from '@/components/SelectionField'
import { MediaUploadField } from '@/components/MediaUploadField'
import { Button } from '@/components/Loading'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import { api } from '@/lib/api'
import { buildKycSubmission, emptyKycDraft, validateKycStep, type KycDraft } from '@/lib/kyc'

const countries = Country.getAllCountries().map(c => ({ value: c.name, label: `${c.flag} ${c.name}` }))
const steps = ['Personal information', 'ID documents', 'Address verification', 'Selfie']
export default function KYCScreen() {
  const { user } = useAuth()
  const p = usePalette(); const neu = useNeu()
  const [draft, setDraft] = useState<KycDraft>(emptyKycDraft)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [uploads, setUploads] = useState(0)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const change = <K extends keyof KycDraft>(key: K, value: KycDraft[K]) => setDraft(d => ({ ...d, [key]: value }))
  const country = Country.getAllCountries().find(c => c.name === draft.country)
  const states = State.getStatesOfCountry(country?.isoCode || '')
  const region = states.find(s => s.name === draft.state)
  const cities = region ? City.getCitiesOfState(country!.isoCode, region.isoCode) : []
  function next() { const issue = validateKycStep(draft, step); if (issue) { setError(issue); return } setError(''); setStep(s => s + 1) }
  async function locate() {
    setLocating(true)
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Location permission was declined. You can choose your address manually.')
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const [address] = await Location.reverseGeocodeAsync(position.coords)
      if (!address) throw new Error('No address was found. Choose your address manually.')
      const foundCountry = Country.getAllCountries().find(c => c.isoCode === address.isoCountryCode)
      setDraft(d => ({ ...d, country: foundCountry?.name || d.country, state: address.region || '', city: address.city || address.subregion || '', street: [address.streetNumber, address.street].filter(Boolean).join(' '), postalCode: address.postalCode || '', proofMethod: foundCountry?.isoCode === 'GH' ? d.proofMethod : 'document' }))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not find your location.') }
    finally { setLocating(false) }
  }
  async function submit() {
    setBusy(true); setError('')
    try { await api.post('/kyc/identity', buildKycSubmission(draft)); setSubmitted(true) }
    catch (e) { setError(e instanceof Error ? e.message : 'Submission failed. Please try again.') }
    finally { setBusy(false) }
  }
  const field = (label: string, key: keyof KycDraft) => <TextInput label={label} value={draft[key]} onChangeText={v => change(key, v)} mode="outlined" />
  const upload = (label: string, key: 'idFront' | 'idBack' | 'addressDoc' | 'selfie', document = false) => <MediaUploadField label={label} value={draft[key]} onChange={v => change(key, v)} document={document} onBusyChange={v => setUploads(n => n + (v ? 1 : -1))} />
  if (!user) return <SignInRequired what="identity verification" />
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Stack.Screen options={{ title: 'Identity verification' }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}>
      {submitted ? <View style={{ gap: 16 }}><Text variant="headlineMedium">Verification submitted</Text><Text>Your information and documents are under review. Follow your status from Verification.</Text><Button mode="contained" onPress={() => router.replace('/verification')}>View verification status</Button></View> : <>
        <Text style={{ color: p.text, fontFamily: 'Outfit_800ExtraBold', fontSize: 26 }}>Verify your identity</Text>
        <Text style={{ color: p.textSecondary }}>Step {step + 1} of 4 · {steps[step]}</Text>
        <ProgressBar progress={(step + 1) / 4} color={p.primary} />
        <View style={{ ...neu.raised, backgroundColor: p.surface, borderRadius: 24, padding: 20, gap: 16 }}>
          {step === 0 && <>{field('Full name', 'fullName')}<BrandedDateField label="Date of birth" value={draft.dateOfBirth} onChange={v => change('dateOfBirth', v)} maxDate={new Date()} /><SelectionField label="Nationality" value={draft.nationality} options={countries} onChange={v => change('nationality', v)} />{field('ID number', 'idNumber')}</>}
          {step === 1 && <>{upload('Front of your ID', 'idFront', true)}{upload('Back of your ID', 'idBack', true)}</>}
          {step === 2 && <>
            <Button icon="crosshairs-gps" loading={locating} disabled={locating} onPress={() => void locate()}>Use my location</Button>
            <Text style={{ color: p.textSecondary }}>Check the address found by GPS. A location reading does not generate a GhanaPost digital address.</Text>
            <SelectionField label="Country" value={draft.country} options={countries} onChange={v => setDraft(d => ({ ...d, country: v, state: '', city: '', proofMethod: v === 'Ghana' ? d.proofMethod : 'document' }))} />
            {states.length ? <SelectionField label="State or province" value={draft.state} options={states.map(s => ({ value: s.name, label: s.name }))} onChange={v => setDraft(d => ({ ...d, state: v, city: '' }))} /> : field('State or province', 'state')}
            {cities.length > 0 && <SelectionField label="Choose a city" value={draft.city} options={Array.from(new Set(cities.map(c => c.name))).map(name => ({ value: name, label: name }))} onChange={v => change('city', v)} />}
            {field('City or town', 'city')}
            <SelectionField label="Proof of address" value={draft.proofMethod} options={[...(draft.country === 'Ghana' ? [{ value: 'ghana_post_gps', label: 'GhanaPost GPS address' }] : []), { value: 'document', label: 'Upload a document' }]} onChange={v => change('proofMethod', v as KycDraft['proofMethod'])} />
            {draft.proofMethod === 'ghana_post_gps' ? field('GhanaPost GPS address', 'gpsAddress') : <>{field('Street address', 'street')}{field('Postal code (optional)', 'postalCode')}{upload('Utility bill or bank statement', 'addressDoc', true)}</>}
          </>}
          {step === 3 && <><Text style={{ color: p.textSecondary }}>Take or choose a clear selfie holding your ID.</Text>{upload('Selfie holding your ID', 'selfie')}</>}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          {step > 0 && <Button disabled={busy || uploads > 0} onPress={() => { setError(''); setStep(s => s - 1) }}>Back</Button>}
          <Button mode="contained" loading={busy} disabled={busy || uploads > 0} onPress={step === 3 ? () => void submit() : next}>{step === 3 ? 'Submit verification' : 'Continue'}</Button>
        </View>
      </>}
    </ScrollView>
    <Snackbar visible={!!error} duration={Infinity} onDismiss={() => setError('')} action={{ label: 'Dismiss', onPress: () => setError('') }}>{error}</Snackbar>
  </KeyboardAvoidingView>
}
