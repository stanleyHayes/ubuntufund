import { useState } from 'react'
import { Alert, Box, Button, Typography } from '@mui/material'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { insetSurface } from '@/lib/surfaces'
interface Props { url: string; label: string }
/** Uploads are stored on Cloudinary; anything else is shown as inert text so a reviewer never loads an unknown host. */
function cloudinaryUrl(url: string): URL | null {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && !parsed.port && !parsed.username && !parsed.password ? parsed : null } catch { return null }
}
export function PublicationMediaPreview({ url, label }: Props) {
  const [failedUrl, setFailedUrl] = useState('')
  const safeUrl = cloudinaryUrl(url)
  return <Box sx={{ minWidth: 0 }}>
    <Typography variant="subtitle2">{label}</Typography>
    {!safeUrl ? <Alert severity="warning" sx={{ mt: 1 }}>
      This media is not hosted in Ujimora image storage, so it is not previewed or linked. Do not approve it until you have inspected it through your approved moderation workflow.
      <Typography component="span" variant="body2" sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}>{url}</Typography>
    </Alert> : <>
      <Box sx={{ ...insetSurface, mt: 1, p: 1, display: 'flex', justifyContent: 'center' }}>
        {failedUrl === url ? <Typography role="status" sx={{ py: 4, px: 1, textAlign: 'center' }}>Preview could not load. Open the original to inspect it.</Typography> : <Box component="img" src={safeUrl.href} alt={`${label} preview`} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailedUrl(url)} sx={{ display: 'block', maxWidth: '100%', maxHeight: { xs: 280, sm: 360 }, objectFit: 'contain' }} />}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}>{safeUrl.href}</Typography>
      <Button component="a" href={safeUrl.href} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewRoundedIcon />} aria-label={`Open original ${label}`}>Open original</Button>
    </>}
  </Box>
}
