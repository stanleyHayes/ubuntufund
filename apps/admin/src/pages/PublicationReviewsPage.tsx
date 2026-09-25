import TextField from '@/components/AdminTextField'
import ReviewQueuePagination from '@/components/ReviewQueuePagination'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import PageHeader from '@/components/PageHeader'
import { raisedSurface } from '@/lib/surfaces'
import { ReviewQueueSkeleton, ReviewQueueEmpty, ReviewQueueToolbar } from '@/components/ReviewQueueStates'
import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable } from '@/lib/exports/report'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, MenuItem, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { PublicationMediaPreview } from '@/components/PublicationMediaPreview'
function displayText(action: string, text: string): string {
  if (action === 'comment.create' || action === 'donation.public_content' || action === 'tip.public_content' || action === 'campaign.create' || action === 'creator.profile' || action === 'organization.profile' || action === 'account.profile') {
    try { const fields: unknown = JSON.parse(text); if (fields && typeof fields === 'object' && !Array.isArray(fields)) return Object.entries(fields).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join('\n\n') } catch { /* Show original evidence. */ }
  }
  if (!action.startsWith('update.')) return text
  try { const parts: unknown = JSON.parse(text); if (Array.isArray(parts) && parts.length === 3 && parts.every(part => typeof part === 'string')) return `${parts[0]}\n\n${parts[1]}\n\nUpdate type: ${parts[2]}` } catch { /* Keep the original evidence if it is not structured text. */ }
  return text
}
/** Profile proposals bind the proposed photo and cover URLs in their text, so name those attachments for the reviewer. */
function mediaLabel(action: string, text: string, url: string, index: number): string {
  if (action === 'creator.profile' || action === 'account.profile') {
    try { const fields: unknown = JSON.parse(text); if (fields && typeof fields === 'object' && !Array.isArray(fields)) { const { avatarUrl, coverUrl } = fields as Record<string, unknown>; if (url === avatarUrl && url === coverUrl) return 'Photo and cover'; if (url === avatarUrl) return 'Photo'; if (url === coverUrl) return 'Cover' } } catch { /* Fall back to the attachment number. */ }
  }
  return `Media ${index + 1}`
}
type Item = { version?: string; id: string; action: string; actorId: string; text: string; mediaUrls: string[]; status: string; reason: string; reviewNotes?: string }
export default function PublicationReviewsPage() {
  const { user } = useAuth()
  const [kind, setKind] = useState(() => { const queue = new URLSearchParams(window.location.search).get('queue'); return queue === 'tip-content-reviews' || queue === 'donation-content-reviews' ? queue : 'publication-reviews' })
  const endpoint = `/admin/${kind}`
  const revision = useRef(0)
  const [items, setItems] = useState<Item[]>([]), [status, setStatus] = useState('pending'), [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [notes, setNotes] = useState<Record<string, string>>({}), [busy, setBusy] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [pageSize, setPageSize] = useState(12)
  const load = useCallback(async () => {
    const current = ++revision.current
    setLoading(true)
    setItems([])
    try { const data = await api.get<{ items: Item[]; total: number }>(`${endpoint}?status=${status}&page=${page}&pageSize=${pageSize}`); if (current !== revision.current) return; setItems(data.items); setTotal(data.total); setError('') }
    catch { if (current !== revision.current) return; setItems([]); setError('Could not load publication reviews. Please retry.') }
    finally { if (current === revision.current) setLoading(false) }
  }, [pageSize, page, status, endpoint])
  useEffect(() => { void load(); return () => { revision.current++ } }, [load])
  async function decide(item: Item, decision: 'approved' | 'rejected') {
    setBusy(item.id)
    try { await api.put(`${endpoint}/${item.id}/review`, { decision, notes: notes[item.id], ...(item.version ? { version: item.version } : {}) }); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save review') }
    finally { setBusy('') }
  }
  return <Stack spacing={3}>
    <PageHeader title="Publication reviews" eyebrow="Trust & safety" lede="Review proposed public content and keep each decision tied to its author and version." icon={<FactCheckRoundedIcon />} stats={[{ label: "Submissions in this view", value: loading ? <Skeleton width={60} /> : error ? "—" : total }]} />
    <ReviewQueueToolbar>
      <TextField optionContext="publication" select sx={{ maxWidth: { sm: 420 } }} label="Content queue" value={kind} disabled={!!busy} onChange={event => { setKind(event.target.value); setPage(1); setNotes({}) }}><MenuItem value="publication-reviews">Publication proposals</MenuItem><MenuItem value="tip-content-reviews">Supporter names and messages</MenuItem><MenuItem value="donation-content-reviews">Campaign donor names and messages</MenuItem></TextField>
      <TextField optionContext="publication" select sx={{ maxWidth: { sm: 280 } }} label="Review status" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>{['pending', 'approved', 'rejected'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      <Button variant="outlined" startIcon={<RefreshRoundedIcon />} disabled={loading || !!busy} onClick={() => void load()}>Refresh publication reviews</Button>
      <ExportMenu title="Publication reviews" disabled={loading || !!error} getReport={async progress => ({ title: "Publication reviews", filters: [`Queue: ${kind}`, `Status: ${status}`], tables: [exportTable("Publication reviews", await loadAll<Item>(`${endpoint}?status=${status}`, progress), { ID: r => r.id, Action: r => r.action, Author: r => r.actorId, Status: r => r.status, Reason: r => r.reason, Text: r => displayText(r.action, r.text), Notes: r => r.reviewNotes })] })} />
    </ReviewQueueToolbar>

    {kind !== 'publication-reviews' ? <Typography>Review the exact public name and message. Approval makes this text eligible for public display. The payment has already settled; decisions do not change funds. Anonymous names remain hidden.</Typography> : <Typography>Review the complete proposed text and every attached media item before deciding. Approval applies only to this author and version for seven days; the author must submit it again. It does not publish content, authorize a campaign goal or move funds. Review notes are visible to the author.</Typography>}
    {error && <Alert severity="error">{error}</Alert>}


    {loading ? <ReviewQueueSkeleton label="Loading publication reviews" /> : items.map(item => { const ownSubmission = item.status === 'pending' && !!user?.id && item.actorId === user.id; return <Paper key={item.id} sx={{ ...raisedSurface, p: { xs: 2, sm: 3 } }}><Stack spacing={2}>
      <Typography variant="h6">{item.action.replace('.', ' ')} · {item.reason.replaceAll('_', ' ')}</Typography>
      <Typography variant="caption">Author {item.actorId} · Reference {item.id}</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{displayText(item.action, item.text)}</Typography>
      {!!item.mediaUrls.length && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>{item.mediaUrls.map((url, index) => <PublicationMediaPreview key={`${index}:${url}`} url={url} label={mediaLabel(item.action, item.text, url, index)} />)}</Box>}
      {!!item.mediaUrls.length && <Alert severity="warning">Inspect each attachment through your approved moderation workflow. A URL or text check does not verify the actual media.</Alert>}
      {item.reviewNotes && <Typography>Decision notes: {item.reviewNotes}</Typography>}
      {item.status === 'pending' && <>
        {/* The API refuses self-review; say why before the reviewer writes notes. */}
        {ownSubmission && <Alert severity="info">You submitted this. Another administrator must review it.</Alert>}
        <TextField optionContext="publication" label="Review notes (at least 20 characters)" multiline minRows={2} value={notes[item.id] ?? ''} onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))} inputProps={{ maxLength: 2000 }} />
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2}>
          <Button disabled={ownSubmission || !!busy || (notes[item.id]?.trim().length ?? 0) < 20} onClick={() => void decide(item, 'approved')}>Approve this version</Button>
          <Button color="error" disabled={ownSubmission || !!busy || (notes[item.id]?.trim().length ?? 0) < 20} onClick={() => void decide(item, 'rejected')}>Decline this version</Button>
        </Stack>
      </>}
    </Stack></Paper> })}
    {!loading && !items.length && !error && <ReviewQueueEmpty title="No submissions in this queue." description="New proposals appear here when they need review. Choose another queue or status to see earlier decisions." icon={<FactCheckRoundedIcon />} />}
    {!loading && !error && <ReviewQueuePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} disabled={loading || !!busy} />}
  </Stack>
}
