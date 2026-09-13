import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
function displayText(action: string, text: string): string {
  if (action === 'comment.create' || action === 'campaign.create' || action === 'creator.profile' || action === 'organization.profile' || action === 'account.profile') {
    try { const fields: unknown = JSON.parse(text); if (fields && typeof fields === 'object' && !Array.isArray(fields)) return Object.entries(fields).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join('\n\n') } catch { /* Show original evidence. */ }
  }
  if (!action.startsWith('update.')) return text
  try { const parts: unknown = JSON.parse(text); if (Array.isArray(parts) && parts.length === 3 && parts.every(part => typeof part === 'string')) return `${parts[0]}\n\n${parts[1]}\n\nUpdate type: ${parts[2]}` } catch { /* Keep the original evidence if it is not structured text. */ }
  return text
}
type Item = { id: string; action: string; text: string; status: string; reviewNotes?: string; approvalExpiresAt?: string }
function validQueue(value: unknown): value is { items: Item[]; total: number } {
  if (!value || typeof value !== 'object') return false
  const data = value as { items?: unknown; total?: unknown }
  return Number.isSafeInteger(data.total) && Number(data.total) >= 0 && Array.isArray(data.items) && data.items.every(item =>
    item && typeof item === 'object' && ['id', 'action', 'text', 'status'].every(key => typeof item[key] === 'string') &&
    ['reviewNotes', 'approvalExpiresAt'].every(key => item[key] === undefined || typeof item[key] === 'string'))
}
export function PublicationReviews() {
  const { user } = useAuth()
  return <ViewerReviews key={user?.id ?? 'guest'} />
}
function ViewerReviews() {
  const [items, setItems] = useState<Item[]>([]), [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await api.get<unknown>(`/publication-reviews?page=${page}`); if (!validQueue(data)) throw new Error('Invalid review response'); setItems(data.items); setTotal(data.total); setError('') }
    catch { setItems([]); setTotal(0); setError('Could not load publication reviews. Please retry.') }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { void load() }, [load])
  return <Stack spacing={2} sx={{ py: 2 }}>
    <Typography variant="h6">Publication reviews</Typography>
    <Typography variant="body2">Held live-session titles, campaigns, account identity, creator-page and organization identity changes, URL changes, comments and updates stay private. After approval, submit the same version from its original form within seven days. Changed content needs a new check. For an appeal, contact support@ujimora.com with the reference below.</Typography>
    <Button disabled={loading} onClick={() => void load()}>Refresh publication reviews</Button>
    {error && <Alert severity="error">{error}</Alert>}
    {loading ? <Typography>Loading reviews…</Typography> : items.map(item => <Stack key={item.id} spacing={1} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowWrap: 'anywhere' }}>
      <Typography fontWeight={700}>{item.action.replace('.', ' ')} · {item.status}</Typography>
      <Typography variant="caption">Reference {item.id}</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{displayText(item.action, item.text)}</Typography>
      {item.reviewNotes && <Typography>Review response: {item.reviewNotes}</Typography>}
      {item.approvalExpiresAt && <Typography variant="caption">Approval expires {new Date(item.approvalExpiresAt).toLocaleString()}</Typography>}
    </Stack>)}
    {!loading && !items.length && !error && <Typography>No publication reviews yet.</Typography>}
    <Stack direction="row" spacing={1}><Button disabled={loading || !!error || page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button disabled={loading || !!error || page * 25 >= total} onClick={() => setPage(page + 1)}>Next</Button></Stack>
  </Stack>
}
