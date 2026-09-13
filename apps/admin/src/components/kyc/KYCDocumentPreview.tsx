import { useEffect, useState } from 'react'
import { Alert, Box, Button, Skeleton, Typography } from '@mui/material'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { api } from '@/lib/api'
interface Props { url: string; label: string }
export function KYCDocumentPreview({ url, label }: Props) {
  const [privateAccess, setPrivateAccess] = useState<{ url: string; mimeType: string; requestedFor: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const isPrivate = /^kyc:\/\/[a-f0-9]{24}$/i.test(url)
  useEffect(() => {
    let cancelled = false
    setPrivateAccess(null); setFailed(false); setLoading(isPrivate)
    if (!isPrivate) return
    setLoading(true)
    void api.get<{ url: string; mimeType: string }>(`/uploads/kyc/${url.slice(6)}/access`).then(result => { if (!cancelled) setPrivateAccess({ ...result, requestedFor: url }) }).catch(() => { if (!cancelled) setFailed(true) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url, isPrivate, attempt])
  let safeUrl: URL | null = null
  try { const parsed = new URL(isPrivate ? (privateAccess?.requestedFor === url ? privateAccess.url : '') : url); if (parsed.protocol === 'https:') safeUrl = parsed } catch { /* Waiting for private access or invalid legacy URL. */ }
  if (loading) return <Skeleton variant="rounded" height={180} />
  if (!safeUrl) return <Box><Typography color="error">Document file is unavailable.</Typography>{isPrivate && <Button onClick={() => setAttempt(attempt + 1)}>Retry private document</Button>}</Box>
  const isPdf = privateAccess?.mimeType === 'application/pdf' || /\.pdf$/i.test(safeUrl.pathname)
  return <Box sx={{ mt: 1.5 }}>
    {!isPrivate && <Alert severity="warning" sx={{ mb: 2 }}>Legacy document link. This file needs migration to authenticated storage and public-link invalidation.</Alert>}
    {failed ? <Typography role="status">Preview could not load. Open the original or refresh the private link.</Typography> : isPdf ? <Box component="iframe" src={safeUrl.href} title={`${label} PDF preview`} sandbox="allow-same-origin" referrerPolicy="no-referrer" sx={{ width: '100%', height: { xs: 300, sm: 440 }, border: 0 }} /> : <Box component="img" src={safeUrl.href} alt={`${label} preview`} referrerPolicy="no-referrer" onError={() => setFailed(true)} sx={{ width: '100%', maxHeight: 360, objectFit: 'contain' }} />}
    <Button component="a" href={safeUrl.href} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewRoundedIcon />} aria-label={`Open original ${label}`}>Open original</Button>
    {isPrivate && <Button onClick={() => setAttempt(attempt + 1)}>Refresh expiring link</Button>}
  </Box>
}
