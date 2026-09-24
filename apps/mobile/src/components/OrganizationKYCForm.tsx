import { useState } from 'react'
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { Text, Checkbox, Snackbar } from 'react-native-paper'
import { Stack, router } from 'expo-router'
import { Country } from 'country-state-city'
import { latestAdultBirthDate, KYC_COLLECTION_NOTICE, KYC_IDENTITY_DOCUMENT_OPTIONS, type KYCIdentityDocumentType } from '@ubuntu-fund/types'
import { BrandedTextInput } from './BrandedTextInput'
import { BrandedDateField } from './BrandedDateField'
import { SelectionField } from './SelectionField'
import { MediaUploadField } from './MediaUploadField'
import { Button } from './Loading'
import { usePalette } from '@/context/ColorModeContext'
import { api } from '@/lib/api'
import { buildOrganizationKyc, emptyOrganizationKyc, type OrganizationKycDraft } from '@/lib/organizationKyc'
const countries = Country.getAllCountries().map(c => ({ value: c.name, label: `${c.flag} ${c.name}` }))
const roles = [{ value: 'director', label: 'Director' }, { value: 'trustee', label: 'Trustee' }, { value: 'beneficial_owner', label: 'Beneficial owner' }, { value: 'other_controller', label: 'Other controller' }]
export function OrganizationKYCForm() {
  const p = usePalette()
  const [draft, setDraft] = useState(emptyOrganizationKyc)
  const [saving, setSaving] = useState(false)
  const [uploads, setUploads] = useState(0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const busy = saving || uploads > 0
  const change = <K extends keyof OrganizationKycDraft>(key: K, value: OrganizationKycDraft[K]) => setDraft(old => ({ ...old, [key]: value }))
  const field = (key: 'businessName' | 'registrationNumber' | 'businessType' | 'taxId' | 'street' | 'city' | 'fullName' | 'idNumber' | 'representativeCapacity' | 'ownershipExplanation', label: string) => <BrandedTextInput disabled={busy} label={label} value={draft[key]} onChangeText={value => change(key, value)} maxLength={key === 'ownershipExplanation' ? 2000 : ['registrationNumber', 'businessType', 'taxId', 'idNumber'].includes(key) ? 100 : 200} multiline={key === 'ownershipExplanation'} />
  async function submit() {
    if (busy || saved) return
    setError('')
    try {
      const payload = buildOrganizationKyc(draft)
      setSaving(true)
      await api.post('/kyc/business', payload)
      setSaved(true); setDraft(emptyOrganizationKyc())
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit. Your entries are preserved; please retry.') }
    finally { setSaving(false) }
  }
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Stack.Screen options={{ title: 'Organization verification' }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 100 }}>
      <Text variant="headlineMedium">Organization verification</Text>
      {saved ? <><Text>Organization verification submitted for review.</Text><Button mode="contained" onPress={() => router.replace('/verification')}>View verification status</Button></> : <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 16 }}>
        <Text>Provide private registration and evidence that you can act for the organization. Authorized staff will review these details.</Text>
        <Button disabled={busy} onPress={() => router.push('/verification')}>View status and information requests</Button>
        <Text variant="titleLarge">Registration and address</Text>
        {field('businessName', 'Legal organization name')}{field('registrationNumber', 'Registration number')}{field('businessType', 'Organization legal type')}{field('taxId', 'Tax ID (optional)')}{field('street', 'Registered street address')}{field('city', 'Registered city')}
        <SelectionField disabled={busy} label="Registered country" value={draft.country} options={countries} onChange={value => change('country', value)} />
        <Text variant="titleLarge">Authorized representative</Text>
        {field('fullName', 'Representative full name')}
        <BrandedDateField disabled={busy} label="Representative date of birth" value={draft.dateOfBirth} onChange={value => { if (!busy) change('dateOfBirth', value) }} maxDate={new Date(latestAdultBirthDate())} />
        <SelectionField disabled={busy} label="Representative nationality" value={draft.nationality} options={countries} onChange={value => change('nationality', value)} />
        {field('idNumber', 'Representative ID number')}{field('representativeCapacity', 'Role and authority to act')}
        <Text variant="titleLarge">People who control the organization</Text>
        <Text>List applicable directors, trustees, beneficial owners or other controllers. If there are no shareholders, explain governance and leave ownership percentages empty.</Text>
        {draft.controllers.map((person, index) => {
          const update = (key: keyof typeof person, value: string) => change('controllers', draft.controllers.map((item, i) => i === index ? { ...item, [key]: value } : item))
          return <View key={index} style={{ gap: 12 }}>
            <BrandedTextInput disabled={busy} label={`Person ${index + 1} full name`} value={person.fullName} maxLength={200} onChangeText={value => update('fullName', value)} />
            <SelectionField disabled={busy} label={`Person ${index + 1} role`} value={person.role} options={roles} onChange={value => update('role', value)} />
            <SelectionField disabled={busy} label={`Person ${index + 1} country`} value={person.country} options={countries} onChange={value => update('country', value)} />
            <BrandedTextInput disabled={busy} label={`Person ${index + 1} ownership percentage (optional)`} keyboardType="decimal-pad" value={person.ownershipPercent} onChangeText={value => update('ownershipPercent', value)} />
            <Button disabled={busy || draft.controllers.length === 1} onPress={() => change('controllers', draft.controllers.filter((_, i) => i !== index))}>Remove person {index + 1}</Button>
          </View>
        })}
        <Button disabled={busy || draft.controllers.length >= 50} onPress={() => change('controllers', [...draft.controllers, { fullName: '', role: 'director', country: 'Ghana', ownershipPercent: '' }])}>Add controlling person</Button>
        {field('ownershipExplanation', 'Explain ownership and control')}
        <Text variant="titleLarge">Private supporting documents</Text>
        <SelectionField disabled={busy} label="Representative identity document type" value={draft.identityType} options={[...KYC_IDENTITY_DOCUMENT_OPTIONS]} onChange={value => setDraft(old => value === old.identityType ? old : { ...old, identityType: value as KYCIdentityDocumentType, identity: '' })} />
        {([['registration', 'Organization registration document'], ['authorization', 'Representative authorization document'], ['identity', 'Representative identity document'], ['control', 'Ownership or control register (optional)']] as const).map(([key, label]) => <MediaUploadField disabled={busy} key={`${key}:${key === 'identity' ? draft.identityType : key}`} label={label} value={draft[key]} onChange={value => change(key, value)} folder="kyc" document onBusyChange={value => setUploads(n => n + (value ? 1 : -1))} />)}
        <Text style={{ color: p.textSecondary }}>{KYC_COLLECTION_NOTICE}</Text>
        <Checkbox.Item disabled={busy} status={draft.authorized ? 'checked' : 'unchecked'} onPress={() => change('authorized', !draft.authorized)} label="I am authorized to submit this application and act for the organization." />
        <Checkbox.Item disabled={busy} status={draft.accurate ? 'checked' : 'unchecked'} onPress={() => change('accurate', !draft.accurate)} label="The organization, representative and control details are accurate and complete to the best of my knowledge." />
        {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
        <Button mode="contained" loading={saving} disabled={busy || !draft.authorized || !draft.accurate} onPress={() => void submit()}>{uploads ? 'Uploading documents…' : 'Submit organization verification'}</Button>
      </View>}
    </ScrollView>
    <Snackbar visible={!!error} onDismiss={() => setError('')} duration={10000} action={{ label: 'Dismiss', onPress: () => setError('') }}>{error}</Snackbar>
  </KeyboardAvoidingView>
}
