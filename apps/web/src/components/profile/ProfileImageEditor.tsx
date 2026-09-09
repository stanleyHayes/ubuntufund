import { ImageUpload, MAX_IMAGE_UPLOAD_MB } from '@ubuntu-fund/ui'
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import { LoadingDots } from '@ubuntu-fund/ui'
import { uploadImageViaApi } from '@/lib/uploadImage'
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
  const [uploading, setUploading] = useState(false)
  const locked = busy || uploading
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
  return <Dialog open onClose={locked ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="image-editor-title">
    <DialogTitle id="image-editor-title">Update {title}</DialogTitle>
    <DialogContent>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Choose a JPG, PNG or WebP image, up to {MAX_IMAGE_UPLOAD_MB} MB. {kind === 'coverUrl' ? 'A wide landscape image works best.' : 'A square image works best.'}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <ImageUpload
        value={url}
        onChange={(next) => { setUrl(next); setError('') }}
        label={title}
        helperText={kind === 'coverUrl' ? 'Choose a landscape photo for your cover.' : 'Choose a square photo for your profile.'}
        accept="image/jpeg,image/png,image/webp"
        aspectRatio={kind === 'coverUrl' ? 16 / 9 : 1}
        disabled={locked}
        uploadFn={async (file, onProgress) => {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.')
          setUploading(true)
          try { return await uploadImageViaApi(file, 'profiles', onProgress) }
          finally { setUploading(false) }
        }}
      />
      <Button onClick={() => { setUrl(''); setError('') }} disabled={locked || !url} sx={{ mt: 1 }}>Use default image</Button>
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={locked}>Cancel</Button><Button variant="contained" onClick={save} disabled={locked}>{busy ? <LoadingDots /> : 'Save image'}</Button></DialogActions>
  </Dialog>
}
