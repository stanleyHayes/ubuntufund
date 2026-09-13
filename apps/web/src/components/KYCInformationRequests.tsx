import { useEffect, useState } from 'react'
import { Alert, Box, Button, MenuItem, Paper, Typography } from '@mui/material'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'
import { uploadImageViaApi } from '@/lib/uploadImage'
import { PrivateDocumentUpload } from '@/components/auth/PrivateDocumentUpload'

type Exchange = { id: string; prompt: string; requestedAt: string; response?: string; respondedAt?: string }
type Verification = { expiresAt?: string; rejectionReason?: string; id: string; type: string; status: string; informationRequests?: Exchange[] }
const documentTypes = { id_card: 'ID card', passport: 'Passport', selfie: 'Selfie holding ID', drivers_license: 'Driving licence', utility_bill: 'Utility bill', bank_statement: 'Bank statement', business_registration: 'Business registration', tax_certificate: 'Tax certificate', authorization_letter: 'Representative authorization', ownership_register: 'Ownership or control register' }
const upload = (file: File, progress: (percent: number) => void) => uploadImageViaApi(file, 'kyc', progress)

function ResponseForm({ verificationId, exchange, onSaved }: { verificationId: string; exchange: Exchange; onSaved: () => void }) {
  const [response, setResponse] = useState('')
  const [documents, setDocuments] = useState<Array<{ type: string; url: string }>>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (saving || saved || !response.trim()) return
    setSaving(true); setError('')
    try {
      await api.post(`/kyc/${verificationId}/respond-info`, { requestId: exchange.id, response: response.trim(), documents: documents.filter(item => item.url) })
      setSaved(true); onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your response. Please retry or refresh the status.') }
    finally { setSaving(false) }
  }
  if (saved) return <Alert severity="success">Your response was submitted for review.</Alert>
  return <Box component="fieldset" disabled={saving} sx={{ border: 0, p: 0, m: 0, mt: 2, minWidth: 0 }}>
    <TextField fullWidth multiline minRows={3} label="Your response" value={response} onChange={event => setResponse(event.target.value)} inputProps={{ maxLength: 2000 }} helperText="Provide only the information requested by the verification team." />
    {documents.map((item, index) => <Box key={index} sx={{ mt: 2 }}>
      <TextField select fullWidth label={`Document ${index + 1} type`} value={item.type} onChange={event => setDocuments(previous => previous.map((doc, position) => position === index ? { ...doc, type: event.target.value } : doc))}>
        {Object.entries(documentTypes).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
      </TextField>
      <PrivateDocumentUpload value={item.url} onChange={url => setDocuments(previous => previous.map((doc, position) => position === index ? { ...doc, url } : doc))} uploadFn={upload} label={`Private document ${index + 1}`} accept="image/*,application/pdf" />
      <Button onClick={() => setDocuments(previous => previous.filter((_, position) => position !== index))}>Remove document {index + 1}</Button>
    </Box>)}
    <Button disabled={saving || documents.length >= 10} onClick={() => setDocuments(previous => [...previous, { type: 'id_card', url: '' }])}>Attach a private document</Button>
    {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
    <Button variant="contained" disabled={saving || !response.trim() || documents.some(item => !item.url)} onClick={() => void submit()}>{saving ? 'Submitting…' : 'Submit response'}</Button>
  </Box>
}

export default function KYCInformationRequests() {
  const [records, setRecords] = useState<Verification[]>([])
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = () => { setLoading(true); setError(''); setRevision(value => value + 1) }
  useEffect(() => {
    let active = true
    api.get<{ verifications: Verification[] }>('/kyc/status').then(result => {
      if (active) setRecords(result.verifications)
    }).catch(cause => {
      if (active) { setRecords([]); setError(cause instanceof Error ? cause.message : 'Could not load verification requests.') }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  return <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
    <Typography variant="h6">Verification requests</Typography>
    <Button disabled={loading} onClick={refresh}>{loading ? 'Loading requests…' : 'Refresh verification requests'}</Button>
    {error && <Alert severity="error">{error}</Alert>}
    {!loading && !error && records.filter(record => ['pending', 'approved', 'expired'].includes(record.status)).map(record => <Alert key={record.id} severity={record.status === 'approved' ? 'success' : 'info'} sx={{ my: 2 }}>
      {record.type === 'business' ? 'Organization' : record.type} verification: {record.status === 'pending' ? 'awaiting staff review' : record.status}.
      {record.expiresAt && ` Valid until ${new Date(record.expiresAt).toLocaleDateString()}.`}
      {record.status === 'expired' && ' Submit a new application to renew verification.'}
    </Alert>)}
    {!loading && records.filter(record => record.status === 'rejected').map(record => <Alert key={record.id} severity="warning" sx={{ my: 2 }}>
      <Typography sx={{ fontWeight: 700 }}>Verification rejected · {record.type}</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{record.rejectionReason || 'This application was not approved. Contact support if you need clarification.'}</Typography>
      <Typography>{records.some(item => ['pending', 'in_review'].includes(item.status)) ? 'Another submission is already under review.' : 'Correct your details and submit a new application using the form below.'}</Typography>
    </Alert>)}
    {!loading && !error && !records.some(record => record.informationRequests?.length) && <Typography>No additional information has been requested.</Typography>}
    {!loading && records.map(record => record.informationRequests?.map(exchange => <Box key={exchange.id} sx={{ mt: 2, overflowWrap: 'anywhere' }}>
      <Typography sx={{ fontWeight: 700 }}>{record.type} · Requested {new Date(exchange.requestedAt).toLocaleDateString()}</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{exchange.prompt}</Typography>
      {exchange.respondedAt ? <Box sx={{ mt: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>Your response · {new Date(exchange.respondedAt).toLocaleDateString()}</Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{exchange.response}</Typography>
        <Typography>Status: {record.status.replace(/_/g, ' ')}</Typography>
      </Box> : record.status === 'in_review' ? <ResponseForm verificationId={record.id} exchange={exchange} onSaved={refresh} /> : <Typography>This request is closed. Verification status: {record.status}.</Typography>}
    </Box>))}
  </Paper>
}
