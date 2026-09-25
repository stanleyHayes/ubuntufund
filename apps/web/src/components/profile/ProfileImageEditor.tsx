import { PublicationReviews } from '@/components/account/PublicationReviews'
import { PublicationHeldNotice } from '@/components/safety/PublicationHeldNotice'
import { ImageUpload, MAX_IMAGE_UPLOAD_MB } from '@ubuntu-fund/ui'
import { useState, useEffect, useRef } from 'react'
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
import { useAuth } from '@/context/AuthContext'
import { clearPublicationDraft, isPublicationHeld, publicationDraftKey, readPublicationDraft, writePublicationDraft } from '@/lib/publicationDrafts'

const imageDraft = (value: unknown) => (typeof value === 'string' && value.startsWith('https://') ? value : null)

export function ProfileImageEditor({ kind, currentUrl, onClose, onSaved }: {
  kind: 'avatarUrl' | 'coverUrl'
  currentUrl: string
  onClose: () => void
  onSaved: (url: string) => void
}) {
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const { user } = useAuth()
  // A held image is kept in this browser: re-uploading the same picture makes
  // a new URL, which would need a new review. After approval, reopen and save.
  const draftKey = user?.id ? publicationDraftKey(`profile-${kind}`, user.id) : null
  const [heldUrl] = useState(() => {
    const held = draftKey ? readPublicationDraft(draftKey, imageDraft) : null
    return held && held !== currentUrl ? held : null
  })
  const [url, setUrl] = useState(heldUrl ?? currentUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Held for safety review: an expected step, shown as a notice.
  const [held, setHeld] = useState(false)
  const [uploading, setUploading] = useState(false)
  const locked = busy || uploading
  const title = kind === 'coverUrl' ? 'cover image' : 'profile image'
  async function save() {
    setBusy(true); setError(''); setHeld(false)
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
      if (!live.current) return
      try {
        await api.put('/profile', { [kind]: next })
      } catch (err) {
        if (draftKey && next) writePublicationDraft(draftKey, next)
        throw err
      }
      if (draftKey) clearPublicationDraft(draftKey)
      if (live.current) onSaved(next)
    } catch (err) {
      if (isPublicationHeld(err)) setHeld(true)
      else setError(err instanceof Error ? err.message : 'Could not save image. Try again.')
    }
    finally { setBusy(false) }
  }
  return <Dialog open onClose={locked ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="image-editor-title">
    <DialogTitle id="image-editor-title">Update {title}</DialogTitle>
    <DialogContent>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Choose a JPG, PNG or WebP image, up to {MAX_IMAGE_UPLOAD_MB} MB. {kind === 'coverUrl' ? 'A wide landscape image works best.' : 'A square image works best.'}</Typography>
      {error && <><Alert severity="error" sx={{ mb: 2 }}>{error}</Alert><PublicationReviews /></>}
      {held && <><PublicationHeldNotice retry="save the same image again" reviews="below" sx={{ mb: 2 }} /><PublicationReviews /></>}
      {heldUrl && url === heldUrl && <Alert severity="info" sx={{ mb: 2 }}>This is the image you last submitted. If it is waiting for review, save it again after it is approved.</Alert>}
      <Typography sx={{ mb: 2 }}>New images need staff review. A held image is kept in this browser; after approval, save the same image again. Removing your image with “Use default image” takes effect right away.</Typography>
      <ImageUpload
        value={url}
        onChange={(next) => { setUrl(next); setError(''); setHeld(false) }}
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
      <Button onClick={() => { setUrl(''); setError(''); setHeld(false) }} disabled={locked || !url} sx={{ mt: 1 }}>Use default image</Button>
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={locked}>Cancel</Button><Button variant="contained" onClick={save} disabled={locked}>{busy ? <LoadingDots /> : 'Save image'}</Button></DialogActions>
  </Dialog>
}
