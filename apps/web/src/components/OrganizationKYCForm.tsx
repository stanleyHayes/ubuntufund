import { useState, type FormEvent } from 'react'
import { useSeo } from '@/lib/seo'
import { Alert, Box, Button, Checkbox, Container, FormControlLabel, MenuItem, Paper, Typography } from '@mui/material'
import { BrandedDatePicker, BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { adultBirthDateError, latestAdultBirthDate, KYC_IDENTITY_DOCUMENT_OPTIONS, type KYCIdentityDocumentType } from '@ubuntu-fund/types'
import { COUNTRY_OPTIONS } from '@/data/countries'
import { api } from '@/lib/api'
import { uploadImageViaApi } from '@/lib/uploadImage'
import { PrivateDocumentUpload } from '@/components/auth/PrivateDocumentUpload'
import KYCInformationRequests from '@/components/KYCInformationRequests'

type Controller = { fullName: string; role: string; country: string; ownershipPercent: string }
const emptyController = (): Controller => ({ fullName: '', role: 'director', country: 'Ghana', ownershipPercent: '' })
const initial = { businessName: '', registrationNumber: '', businessType: '', taxId: '', street: '', city: '', country: 'Ghana', fullName: '', nationality: 'Ghana', idNumber: '', representativeCapacity: '', ownershipExplanation: '' }
export default function OrganizationKYCForm() {
  useSeo({ title: 'Organization verification | Ujimora', description: 'Submit private organization verification evidence.', path: '/kyc', robots: 'noindex, nofollow' })
  const [fields, setFields] = useState(initial)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [controllers, setControllers] = useState<Controller[]>([emptyController()])
  const [idType, setIdType] = useState<KYCIdentityDocumentType>('id_card')
  const [documents, setDocuments] = useState({ registration: '', authorization: '', identity: '', control: '' })
  const [authorized, setAuthorized] = useState(false)
  const [accurate, setAccurate] = useState(false)
  const [uploads, setUploads] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const busy = saving || uploads > 0
  const field = (key: keyof typeof initial, label: string, optional = false) => <TextField fullWidth required={!optional} label={label} value={fields[key]} onChange={e => setFields(old => ({ ...old, [key]: e.target.value }))} inputProps={{ maxLength: key === 'ownershipExplanation' ? 2000 : ['registrationNumber', 'taxId', 'businessType', 'idNumber'].includes(key) ? 100 : 200 }} multiline={key === 'ownershipExplanation'} minRows={key === 'ownershipExplanation' ? 3 : undefined} />
  const country = (key: 'country' | 'nationality', label: string) => <TextField select fullWidth required label={label} value={fields[key]} onChange={e => setFields(old => ({ ...old, [key]: e.target.value }))}>{COUNTRY_OPTIONS.map(item => <MenuItem key={item.code} value={item.label}>{item.label}</MenuItem>)}</TextField>
  async function upload(file: File, progress: (percent: number) => void) {
    setUploads(n => n + 1)
    try { return await uploadImageViaApi(file, 'kyc', progress) } finally { setUploads(n => n - 1) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || saved) return
    setError('')
    const ageError = adultBirthDateError(dateOfBirth)
    if (ageError) { setError(ageError); return }
    if (!authorized || !accurate) { setError('Confirm both declarations before submitting.'); return }
    if (!documents.registration || !documents.authorization || !documents.identity) { setError('Upload registration, authorization and representative identity evidence.'); return }
    if (fields.ownershipExplanation.trim().length < 20) { setError('Explain ownership and control in at least 20 characters.'); return }
    if (Object.entries(fields).some(([key, value]) => key !== 'taxId' && !value.trim()) || controllers.some(person => !person.fullName.trim() || !person.country)) { setError('Complete all required organization and representative details.'); return }
    if (controllers.some(person => person.ownershipPercent !== '' && (!Number.isFinite(Number(person.ownershipPercent)) || Number(person.ownershipPercent) < 0 || Number(person.ownershipPercent) > 100))) { setError('Ownership percentages must be between 0 and 100.'); return }
    setSaving(true)
    try {
      await api.post('/kyc/business', {
        personalInfo: { fullName: fields.fullName.trim(), dateOfBirth: new Date(dateOfBirth).toISOString(), nationality: fields.nationality, idNumber: fields.idNumber.trim() },
        businessInfo: { businessName: fields.businessName.trim(), registrationNumber: fields.registrationNumber.trim(), businessType: fields.businessType.trim(), taxId: fields.taxId.trim() || undefined,
          registeredAddress: { street: fields.street.trim(), city: fields.city.trim(), country: fields.country }, representativeCapacity: fields.representativeCapacity.trim(), ownershipExplanation: fields.ownershipExplanation.trim(),
          controlPersons: controllers.map(person => ({ fullName: person.fullName.trim(), role: person.role, country: person.country, ...(person.ownershipPercent !== '' ? { ownershipPercent: Number(person.ownershipPercent) } : {}) })) },
        documents: [{ type: 'business_registration', url: documents.registration }, { type: 'authorization_letter', url: documents.authorization }, { type: idType, url: documents.identity }, ...(documents.control ? [{ type: 'ownership_register', url: documents.control }] : [])],
        declaration: { authorized, accurate },
      })
      setSaved(true)
      setFields(initial); setDocuments({ registration: '', authorization: '', identity: '', control: '' }); setControllers([emptyController()]); setDateOfBirth('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit your application. Your entries are preserved; please retry.') }
    finally { setSaving(false) }
  }
  return <Container maxWidth="md" sx={{ py: 4 }}>
    <Typography variant="h4" sx={{ mb: 2 }}>Organization verification</Typography>
    <Typography sx={{ mb: 3 }}>Provide your registration and evidence that you are authorized to act for the organization. These details and documents are private and reviewed by authorized staff.</Typography>
    <KYCInformationRequests key={saved ? 'submitted' : 'draft'} />
    {saved ? <Alert severity="success">Organization verification submitted for review. Check verification requests here for updates or additional information.</Alert> : <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, sm: 3 } }}>
      <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0, display: 'grid', gap: 2 }}>
        <Typography variant="h6">Registration and registered address</Typography>
        {field('businessName', 'Legal organization name')}{field('registrationNumber', 'Registration number')}{field('businessType', 'Organization legal type')}{field('taxId', 'Tax ID (optional)', true)}
        {field('street', 'Registered street address')}{field('city', 'Registered city')}{country('country', 'Registered country')}
        <Typography variant="h6">Authorized representative</Typography>
        {field('fullName', 'Representative full name')}
        <BrandedDatePicker disabled={busy} label="Representative date of birth" value={dateOfBirth} onChange={setDateOfBirth} maxDate={latestAdultBirthDate()} fullWidth required />
        {country('nationality', 'Representative nationality')}{field('idNumber', 'Representative ID number')}{field('representativeCapacity', 'Role and authority to act')}
        <Typography variant="h6">People who control the organization</Typography>
        <Typography variant="body2">List the applicable directors, trustees, beneficial owners or other controllers. For an organization without shareholders, explain its governance and leave ownership percentages empty.</Typography>
        {controllers.map((person, index) => <Box key={index} sx={{ display: 'grid', gap: 2, border: 1, borderColor: 'divider', p: 2, borderRadius: 2 }}>
          <TextField fullWidth required label={`Person ${index + 1} full name`} value={person.fullName} inputProps={{ maxLength: 200 }} onChange={e => setControllers(old => old.map((item, i) => i === index ? { ...item, fullName: e.target.value } : item))} />
          <TextField select fullWidth label={`Person ${index + 1} role`} value={person.role} onChange={e => setControllers(old => old.map((item, i) => i === index ? { ...item, role: e.target.value } : item))}>{Object.entries({ director: 'Director', trustee: 'Trustee', beneficial_owner: 'Beneficial owner', other_controller: 'Other controller' }).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
          <TextField select fullWidth required label={`Person ${index + 1} country`} value={person.country} onChange={e => setControllers(old => old.map((item, i) => i === index ? { ...item, country: e.target.value } : item))}>{COUNTRY_OPTIONS.map(item => <MenuItem key={item.code} value={item.label}>{item.label}</MenuItem>)}</TextField>
          <TextField fullWidth type="number" label={`Person ${index + 1} ownership percentage (optional)`} value={person.ownershipPercent} inputProps={{ min: 0, max: 100, step: 'any' }} onChange={e => setControllers(old => old.map((item, i) => i === index ? { ...item, ownershipPercent: e.target.value } : item))} />
          <Button disabled={controllers.length === 1 || busy} onClick={() => setControllers(old => old.filter((_, i) => i !== index))}>Remove person {index + 1}</Button>
        </Box>)}
        <Button disabled={controllers.length >= 50 || busy} onClick={() => setControllers(old => [...old, emptyController()])}>Add controlling person</Button>
        {field('ownershipExplanation', 'Explain ownership and control')}
        <Typography variant="h6">Private supporting documents</Typography>
        <TextField select label="Representative identity document type" value={idType} disabled={busy} onChange={e => { setIdType(e.target.value as KYCIdentityDocumentType); setDocuments(old => ({ ...old, identity: '' })) }}>{KYC_IDENTITY_DOCUMENT_OPTIONS.map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</TextField>
        {([['registration', 'Organization registration document'], ['authorization', 'Representative authorization document'], ['identity', 'Representative identity document'], ['control', 'Ownership or control register (optional)']] as const).map(([key, label]) => <PrivateDocumentUpload disabled={busy} key={`${key}:${key === 'identity' ? idType : key}`} label={label} value={documents[key]} onChange={url => setDocuments(old => ({ ...old, [key]: url }))} uploadFn={upload} accept="image/*,application/pdf" />)}
        <FormControlLabel control={<Checkbox checked={authorized} onChange={e => setAuthorized(e.target.checked)} />} label="I am authorized to submit this application and act for the organization." />
        <FormControlLabel control={<Checkbox checked={accurate} onChange={e => setAccurate(e.target.checked)} />} label="The organization, representative and control details are accurate and complete to the best of my knowledge." />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" disabled={busy || !authorized || !accurate}>{saving ? 'Submitting…' : uploads ? 'Uploading documents…' : 'Submit organization verification'}</Button>
      </Box>
    </Paper>}
  </Container>
}
