import { MAX_IMAGE_UPLOAD_MB } from '@ubuntu-fund/ui'
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import { BrandedTextField, LoadingDots } from '@ubuntu-fund/ui'
import { getCloudinaryConfig, uploadToCloudinary } from '@/lib/cloudinary'
import { api } from '@/lib/api'

export function ProfileImageEditor({ kind, currentUrl, onClose, onSaved }: {
  kind: 'avatarUrl' | 'coverUrl'
  currentUrl: string
  onClose: () => void
  onSaved: (url: string) => void
}) {
  const [url, setUrl] = useState(currentUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const config = getCloudinaryConfig()
  const title = kind === 'coverUrl' ? 'cover image' : 'profile image'
  async function save() {
    setBusy(true); setError('')
    try {
      const next = url.trim()
      if (next) {
        if (!next.startsWith('https://')) throw new Error('Enter an HTTPS image URL.')
        await new Promise<void>((resolve, reject) => {
          const image = new Image()
          const timer = window.setTimeout(() => reject(new Error('Image took too long to load. Try another image.')), 10000)
          image.onload = () => { clearTimeout(timer); resolve() }
          image.onerror = () => { clearTimeout(timer); reject(new Error('This image could not be loaded. Choose another image.')) }
          image.src = next
        })
      }
      await api.put('/profile', { [kind]: next })
      onSaved(next)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save image. Try again.') }
    finally { setBusy(false) }
  }
  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="image-editor-title">
    <DialogTitle id="image-editor-title">Update {title}</DialogTitle>
    <DialogContent>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Choose a JPG, PNG or WebP image, up to {MAX_IMAGE_UPLOAD_MB} MB. {kind === 'coverUrl' ? 'A wide landscape image works best.' : 'A square image works best.'}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ height: 160, mb: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', borderRadius: 'var(--shape-card)', overflow: 'hidden' }}>
        {url && failedUrl !== url ? <Box component="img" src={url} alt={`${title} preview`} onError={() => setFailedUrl(url)} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Typography color="text.secondary">{url ? 'Image unavailable' : 'Default image will be used'}</Typography>}
      </Box>
      <Button component="label" variant="outlined" disabled={busy || !config} sx={{ mb: 2 }}>Upload image
        <input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !config} onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (!file || !config) return
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_UPLOAD_MB * 1024 * 1024) { setError(`Choose a JPG, PNG or WebP image no larger than ${MAX_IMAGE_UPLOAD_MB} MB.`); return }
          setBusy(true); setError('')
          try { const result = await uploadToCloudinary(file, config); setFailedUrl(null); setUrl(result.secureUrl) }
          catch (err) { setError(err instanceof Error ? err.message : 'Upload failed. Try again.') }
          finally { setBusy(false) }
        }} />
      </Button>
      {!config && <Typography color="text.secondary" sx={{ mb: 2, fontSize: '0.8rem' }}>Device uploads are unavailable right now. You can use a hosted image link below.</Typography>}
      <BrandedTextField label="Image URL" value={url} onChange={(e) => { setUrl(e.target.value); setFailedUrl(null) }} disabled={busy} fullWidth placeholder="https://…" />
      <Button onClick={() => { setUrl(''); setError('') }} disabled={busy || !url} sx={{ mt: 1 }}>Use default image</Button>
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" onClick={save} disabled={busy}>{busy ? <LoadingDots /> : 'Save image'}</Button></DialogActions>
  </Dialog>
}
