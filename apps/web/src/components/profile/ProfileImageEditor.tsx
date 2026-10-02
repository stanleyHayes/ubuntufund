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
import {
  clearPublicationDraft, heldProfileImage, profileImageDraftKey, publicationHold, publishesOnApproval, readPublicationDraft, writePublicationDraft, type PublicationHold,
} from '@/lib/publicationDrafts'

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
  // a new URL, which would need a new review. It is saved again after a manual
  // approval, or when an approval couldn't publish it.
  const draftKey = user?.id ? profileImageDraftKey(kind, user.id) : null
  const [stored] = useState(() => (draftKey ? readPublicationDraft(draftKey, heldProfileImage) : null))
  // Already the live image (its approval published it): nothing left to submit.
  const heldImage = stored && stored.url !== currentUrl ? stored : null
  useEffect(() => { if (draftKey && stored?.url === currentUrl) clearPublicationDraft(draftKey) }, [draftKey, stored, currentUrl])
  const [url, setUrl] = useState(heldImage?.url ?? currentUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Held for safety review: an expected step, shown as a notice.
  const [held, setHeld] = useState<PublicationHold | null>(null)
  const [uploading, setUploading] = useState(false)
  const locked = busy || uploading
  const title = kind === 'coverUrl' ? 'cover image' : 'profile image'
  async function save() {
    setBusy(true); setError(''); setHeld(null)
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
        if (draftKey && next) writePublicationDraft(draftKey, { url: next, publishesOnApproval: publishesOnApproval(err) })
        throw err
      }
      if (draftKey) clearPublicationDraft(draftKey)
      if (live.current) onSaved(next)
    } catch (err) {
      const hold = publicationHold(err)
      if (hold) setHeld(hold)
      else setError(err instanceof Error ? err.message : 'Could not save image. Try again.')
    }
    finally { setBusy(false) }
  }
  return <Dialog open onClose={locked ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="image-editor-title">
    <DialogTitle id="image-editor-title">Update {title}</DialogTitle>
    <DialogContent>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Choose a JPG, PNG or WebP image, up to {MAX_IMAGE_UPLOAD_MB} MB. {kind === 'coverUrl' ? 'A wide landscape image works best.' : 'A square image works best.'}</Typography>
      {error && <><Alert severity="error" sx={{ mb: 2 }}>{error}</Alert><PublicationReviews actions={['account.profile']} /></>}
      {held && <><PublicationHeldNotice {...held} retry="save the same image again" reviews="below" sx={{ mb: 2 }} /><PublicationReviews actions={['account.profile']} /></>}
      {heldImage && url === heldImage.url && <Alert severity="info" sx={{ mb: 2 }}>
        {heldImage.publishesOnApproval
          ? "This is the image you last submitted. If it's still waiting for review, it goes live automatically once approved. If it couldn't be published, save it again."
          : 'This is the image you last submitted. If it is waiting for review, save it again after it is approved.'}
      </Alert>}
      <Typography sx={{ mb: 2 }}>New images need staff review. A held image is kept in this browser in case you need to save it again. Removing your image with “Use default image” takes effect right away.</Typography>
      <ImageUpload
        value={url}
        onChange={(next) => { setUrl(next); setError(''); setHeld(null) }}
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
      <Button onClick={() => { setUrl(''); setError(''); setHeld(null) }} disabled={locked || !url} sx={{ mt: 1 }}>Use default image</Button>
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={locked}>Cancel</Button><Button variant="contained" onClick={save} disabled={locked}>{busy ? <LoadingDots /> : 'Save image'}</Button></DialogActions>
  </Dialog>
}
