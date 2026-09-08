import { useRef, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { SHAPE } from '../theme'

// ── Cloudinary unsigned upload (browser → Cloudinary, no secret exposed) ──────
// Reads public Vite env vars from the consuming app:
//   VITE_CLOUDINARY_CLOUD_NAME · VITE_CLOUDINARY_UPLOAD_PRESET (unsigned preset)
// When either is missing, uploads are treated as not configured.

const FOREST = '#2E3D2F'
const SAGE = '#A8B5A0'
const GOLD = '#C7A24A'
const CLAY = '#A5432F'
const DIVIDER = 'rgba(46,61,47,0.18)'
const INK_SECONDARY = 'rgba(18,24,15,0.6)'

interface CloudinaryConfig {
  cloudName: string
  uploadPreset: string
}

function getCloudinaryConfig(): CloudinaryConfig | null {
  // Keep `import.meta.env` as a contiguous literal so Vite statically replaces
  // it in the consuming app — aliasing it via a cast on `import.meta` (e.g.
  // `(import.meta as ...).env`) defeats that replacement and reads undefined.
  // Typed via the package's vite-env reference so no ts-comment is needed.
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>
  const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) return null
  return { cloudName, uploadPreset }
}

function uploadToCloudinary(
  file: File,
  config: CloudinaryConfig,
  onProgress: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('upload_preset', config.uploadPreset)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText) as { secure_url?: string }
          if (res.secure_url) return resolve(res.secure_url)
          reject(new Error('Upload succeeded but no URL was returned.'))
        } catch {
          reject(new Error('Could not read the upload response.'))
        }
        return
      }
      let message = `Upload failed (${xhr.status}). Please try again.`
      try {
        const res = JSON.parse(xhr.responseText) as { error?: { message?: string } }
        if (res?.error?.message) message = res.error.message
      } catch { /* keep generic */ }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('Network error during upload. Check your connection.'))
    xhr.onabort = () => reject(new Error('Upload was cancelled.'))
    xhr.send(form)
  })
}

export const MAX_IMAGE_UPLOAD_MB = 4

export interface ImageUploadProps {
  /** Current uploaded asset URL ('' when none). */
  value: string
  /** Called with the uploaded https URL, or '' when removed. */
  onChange: (url: string) => void
  /** Field label (eyebrow-style). */
  label?: string
  /** Helper text under the control. */
  helperText?: string
  /** Accepted file types. Default 'image/*'. Pass e.g. 'image/*,application/pdf' for documents. */
  accept?: string
  /** Preview aspect ratio (width / height). Default 16/9. */
  aspectRatio?: number
  /** External error message (e.g. validation). */
  error?: string
  disabled?: boolean
  /**
   * Optional uploader. When provided, files are uploaded through this function
   * (e.g. via the app's own server-side proxy) instead of straight to
   * Cloudinary — more reliable, since a same-origin request isn't blocked by an
   * ad-blocker / restrictive network. Resolves with the stored https URL.
   */
  uploadFn?: (file: File, onProgress: (percent: number) => void) => Promise<string>
}

/**
 * Upload an image from the device (drag-drop or click) straight to Cloudinary,
 * with a live preview, progress, and replace/remove. Replaces paste-a-URL inputs
 * across the app. When Cloudinary isn't configured it shows a clear disabled
 * state rather than a URL field.
 */
export function ImageUpload({
  value,
  onChange,
  label,
  helperText,
  accept = 'image/*',
  aspectRatio = 16 / 9,
  error,
  disabled,
  uploadFn,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const config = getCloudinaryConfig()
  // Uploading is possible when EITHER an injected uploader is given (preferred)
  // or the direct Cloudinary env config is present.
  const canUpload = !!uploadFn || !!config
  const busy = progress !== null
  const isPdf = value && /\.pdf($|\?)/i.test(value)

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || (!uploadFn && !config)) return
      if (file.size > MAX_IMAGE_UPLOAD_MB * 1024 * 1024) {
        setUploadError(`File is too large (max ${MAX_IMAGE_UPLOAD_MB}MB).`)
        return
      }
      setUploadError(null)
      setProgress(0)
      try {
        const url = uploadFn
          ? await uploadFn(file, setProgress)
          : await uploadToCloudinary(file, config as CloudinaryConfig, setProgress)
        onChange(url)
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      } finally {
        setProgress(null)
      }
    },
    [config, onChange, uploadFn],
  )

  return (
    <Box>
      {label && (
        <Typography
          sx={{
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: GOLD, mb: 1,
          }}
        >
          {label}
        </Typography>
      )}

      {/* Uploaded → preview + actions */}
      {value ? (
        <Box>
          {isPdf ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, border: `1px solid ${DIVIDER}`, borderRadius: SHAPE.card }}>
              <ImageRoundedIcon sx={{ color: SAGE }} />
              <Typography sx={{ fontSize: '0.85rem', color: FOREST, flexGrow: 1, wordBreak: 'break-all' }}>Document uploaded</Typography>
            </Box>
          ) : (
            <Box
              component="img"
              src={value}
              alt="Uploaded preview"
              sx={{ display: 'block', width: '100%', aspectRatio: String(aspectRatio), objectFit: 'cover', borderRadius: SHAPE.card, border: `1px solid ${DIVIDER}` }}
            />
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button type="button" size="small" variant="outlined" disabled={disabled || busy || !canUpload}
              onClick={() => inputRef.current?.click()}
              sx={{ borderRadius: SHAPE.sm, borderColor: DIVIDER, color: FOREST }}>
              Replace
            </Button>
            <Button type="button" size="small" variant="text" color="inherit" disabled={disabled || busy}
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => { onChange(''); setUploadError(null) }}
              sx={{ color: CLAY }}>
              Remove
            </Button>
          </Box>
        </Box>
      ) : canUpload ? (
        /* Empty → dropzone */
        <Box
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && !busy && inputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled && !busy) { e.preventDefault(); inputRef.current?.click() } }}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!disabled && !busy) handleFile(e.dataTransfer.files?.[0]) }}
          sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 1, textAlign: 'center', p: 4, cursor: disabled ? 'default' : 'pointer',
            border: `1.5px dashed ${dragOver ? SAGE : DIVIDER}`,
            bgcolor: dragOver ? 'rgba(168,181,160,0.12)' : 'transparent',
            borderRadius: SHAPE.card, transition: 'border-color .15s ease, background-color .15s ease',
            outline: 'none', '&:focus-visible': { borderColor: SAGE, boxShadow: `0 0 0 3px rgba(168,181,160,0.35)` },
          }}
        >
          {busy ? (
            <>
              <CircularProgress size={22} sx={{ color: GOLD }} />
              <Typography sx={{ fontSize: '0.85rem', color: FOREST, fontWeight: 600 }}>Uploading… {progress}%</Typography>
            </>
          ) : (
            <>
              <CloudUploadRoundedIcon sx={{ fontSize: 32, color: SAGE }} />
              <Typography sx={{ fontSize: '0.9rem', color: FOREST, fontWeight: 600 }}>Click to upload or drag &amp; drop</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: INK_SECONDARY }}>{accept.includes('pdf') ? 'Image or PDF' : 'PNG, JPG or WebP'} · up to {MAX_IMAGE_UPLOAD_MB}MB</Typography>
            </>
          )}
        </Box>
      ) : (
        /* Cloudinary not configured */
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 2.5, border: `1.5px dashed ${DIVIDER}`, borderRadius: SHAPE.card, bgcolor: 'rgba(46,61,47,0.03)' }}>
          <ImageRoundedIcon sx={{ color: SAGE }} />
          <Typography sx={{ fontSize: '0.82rem', color: INK_SECONDARY }}>
            Image uploads aren’t enabled yet. Add <code>VITE_CLOUDINARY_CLOUD_NAME</code> and <code>VITE_CLOUDINARY_UPLOAD_PRESET</code> to turn this on.
          </Typography>
        </Box>
      )}

      {busy && !value && (
        <LinearProgress variant="determinate" value={progress ?? 0}
          sx={{ mt: 1, borderRadius: SHAPE.bar, height: 6, '& .MuiLinearProgress-bar': { bgcolor: GOLD } }} />
      )}

      <input ref={inputRef} type="file" accept={accept} hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleFile(f) }} />

      {(uploadError || error) && (
        <Typography sx={{ mt: 1, fontSize: '0.78rem', color: CLAY }}>{uploadError || error}</Typography>
      )}
      {helperText && !uploadError && !error && (
        <Typography sx={{ mt: 0.75, fontSize: '0.78rem', color: INK_SECONDARY }}>{helperText}</Typography>
      )}
    </Box>
  )
}
