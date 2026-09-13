import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle } from '@mui/material'
import { ImageUpload, type ImageUploadProps } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'
export function PrivateDocumentUpload(props: ImageUploadProps) {
  const [preview, setPreview] = useState<{ url: string; mimeType: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function open() {
    setLoading(true); setError('')
    try { setPreview(await api.get(`/uploads/kyc/${props.value.slice(6)}/access`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load document') }
    finally { setLoading(false) }
  }
  return <Box><ImageUpload {...props} />
    {props.value.startsWith('kyc://') && <Button disabled={loading} onClick={() => { void open() }}>{loading ? 'Loading private document…' : 'Preview private document'}</Button>}
    {error && <Alert severity="error">{error}</Alert>}
    <Dialog open={!!preview} onClose={() => setPreview(null)} fullWidth maxWidth="md"><DialogTitle>{props.label || 'Private document'}</DialogTitle><DialogContent>
      {preview && (preview.mimeType === 'application/pdf' ? <Box component="iframe" src={preview.url} title="Private document preview" sandbox="allow-same-origin" referrerPolicy="no-referrer" sx={{ width: '100%', height: 480, border: 0 }} /> : <Box component="img" src={preview.url} alt={props.label || 'Private document'} referrerPolicy="no-referrer" sx={{ width: '100%', maxHeight: 560, objectFit: 'contain' }} />)}
      {preview && <Button href={preview.url} target="_blank" rel="noopener noreferrer">Open document (link expires after 60 seconds)</Button>}
      <Button onClick={() => setPreview(null)}>Close</Button>
    </DialogContent></Dialog>
  </Box>
}
