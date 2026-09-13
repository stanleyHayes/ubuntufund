import { useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native-paper'
import { Button } from './Loading'
import { BrandedTextInput } from './BrandedTextInput'
import { SelectionField } from './SelectionField'
import { MediaUploadField } from './MediaUploadField'
import { usePalette } from '@/context/ColorModeContext'
import { api } from '@/lib/api'

export type KYCExchange = { id: string; prompt: string; requestedAt: string; response?: string; respondedAt?: string }
const options = [
  { value: 'authorization_letter', label: 'Representative authorization' }, { value: 'ownership_register', label: 'Ownership or control register' },
  { value: 'selfie', label: 'Selfie holding ID' },
  { value: 'id_card', label: 'ID card' }, { value: 'passport', label: 'Passport' }, { value: 'drivers_license', label: 'Driving licence' },
  { value: 'utility_bill', label: 'Utility bill' }, { value: 'bank_statement', label: 'Bank statement' },
  { value: 'business_registration', label: 'Business registration' }, { value: 'tax_certificate', label: 'Tax certificate' },
]
function ResponseForm({ verificationId, requestId, onSaved }: { verificationId: string; requestId: string; onSaved: () => void }) {
  const p = usePalette()
  const [response, setResponse] = useState('')
  const [documents, setDocuments] = useState<Array<{ type: string; url: string }>>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (saving || uploading || saved || !response.trim()) return
    setSaving(true); setError('')
    try {
      await api.post(`/kyc/${verificationId}/respond-info`, { requestId, response: response.trim(), documents: documents.filter(item => item.url) })
      setSaved(true); onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your response. Retry or refresh the verification status.') }
    finally { setSaving(false) }
  }
  if (saved) return <Text style={{ color: p.success }}>Your response was submitted for review.</Text>
  return <View pointerEvents={saving || uploading ? 'none' : 'auto'} style={{ gap: 12, marginTop: 12 }}>
    <BrandedTextInput label="Your response" value={response} onChangeText={setResponse} multiline maxLength={2000} disabled={saving || uploading} />
    <Text style={{ color: p.textSecondary }}>Provide only the information requested by the verification team.</Text>
    {documents.map((item, index) => <View key={index} style={{ gap: 8 }}>
      <SelectionField label={`Document ${index + 1} type`} value={item.type} options={options} onChange={type => setDocuments(previous => previous.map((doc, position) => position === index ? { ...doc, type } : doc))} disabled={saving || uploading} />
      <MediaUploadField label={`Private document ${index + 1}`} value={item.url} folder="kyc" document onBusyChange={setUploading} onChange={url => setDocuments(previous => previous.map((doc, position) => position === index ? { ...doc, url } : doc))} />
      <Button disabled={saving || uploading} onPress={() => setDocuments(previous => previous.filter((_, position) => position !== index))}>Remove document {index + 1}</Button>
    </View>)}
    <Button disabled={saving || uploading || documents.length >= 10} onPress={() => setDocuments(previous => [...previous, { type: 'id_card', url: '' }])}>Attach a private document</Button>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    <Button mode="contained" loading={saving} disabled={saving || uploading || !response.trim() || documents.some(item => !item.url)} onPress={() => void submit()}>Submit response</Button>
  </View>
}
export function KYCInformationHistory({ verificationId, status, exchanges, onSaved }: { verificationId: string; status: string; exchanges: KYCExchange[]; onSaved: () => void }) {
  const p = usePalette()
  return <View style={{ gap: 16, marginTop: 12 }}>
    {exchanges.map(exchange => <View key={exchange.id} style={{ gap: 6 }}>
      <Text style={{ color: p.text, fontFamily: 'Outfit_700Bold' }}>Requested {new Date(exchange.requestedAt).toLocaleDateString()}</Text>
      <Text style={{ color: p.text }}>{exchange.prompt}</Text>
      {exchange.respondedAt ? <>
        <Text style={{ color: p.text, fontFamily: 'Outfit_700Bold' }}>Your response · {new Date(exchange.respondedAt).toLocaleDateString()}</Text>
        <Text style={{ color: p.text }}>{exchange.response}</Text>
      </> : status === 'in_review' ? <ResponseForm key={`${verificationId}:${exchange.id}`} verificationId={verificationId} requestId={exchange.id} onSaved={onSaved} /> : <Text style={{ color: p.textSecondary }}>This information request is closed.</Text>}
    </View>)}
  </View>
}
