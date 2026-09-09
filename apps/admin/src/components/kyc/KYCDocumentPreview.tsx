import { useState } from 'react'
import { Box, Button, Skeleton, Typography } from '@mui/material'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'

interface Props {
  url: string
  label: string
}

export function KYCDocumentPreview({ url, label }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  let safeUrl: URL | null = null
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') safeUrl = parsed
  } catch { /* Missing or malformed legacy document URL. */ }

  if (!safeUrl) return <Typography color="error" variant="body2">Document file is unavailable. Request a replacement from the member.</Typography>
  const isPdf = /\.pdf$/i.test(safeUrl.pathname)

  return (
    <Box sx={{ mt: 1.5 }}>
      {isPdf ? (
        <Box component="iframe" src={safeUrl.href} title={`${label} PDF preview`} referrerPolicy="no-referrer" sx={{ width: '100%', height: { xs: 300, sm: 440 }, border: 0, borderRadius: 1, bgcolor: 'background.paper' }} />
      ) : failed ? (
        <Typography variant="body2" color="text.secondary" role="status">Preview could not load. Open the original file to view it.</Typography>
      ) : (
        <Box sx={{ position: 'relative', minHeight: loaded ? 0 : 180 }}>
          {!loaded && <Skeleton variant="rounded" height={180} aria-label={`Loading ${label}`} />}
          <Box component="img" src={safeUrl.href} alt={`${label} preview`} referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
            sx={{ display: loaded ? 'block' : 'none', width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 1, bgcolor: 'background.paper' }} />
        </Box>
      )}
      <Button component="a" href={safeUrl.href} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewRoundedIcon />} aria-label={`Open original ${label}`} sx={{ mt: 1, textTransform: 'none' }}>
        Open original
      </Button>
      {isPdf && <Typography variant="caption" color="text.secondary" display="block">If the PDF does not display, open the original file in a new tab.</Typography>}
    </Box>
  )
}
