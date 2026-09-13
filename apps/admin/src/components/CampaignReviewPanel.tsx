import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material'
import type { Campaign } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import ExportMenu from './ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { dateCell, exportTable } from '@/lib/exports/report'

type Decision = 'approve' | 'reject' | 'block' | 'reopen'
type Review = { id: string; version: string; actorId: string; action: Decision; reason: string; beforeStatus: string; afterStatus: string; createdAt: string; snapshotErasedAt?: string; snapshot?: { title: string; description: string; beneficiaries: string[]; imageUrls: string[]; goalAmount: number; currency: string; slug: string } }
export default function CampaignReviewPanel({ campaign, onChanged }: { campaign: Campaign; onChanged: () => void }) {
  const { user } = useAuth()
  return <ViewerReview key={`${user?.id}:${campaign.id}:${campaign.reviewVersion}`} campaign={campaign} onChanged={onChanged} />
}
function ViewerReview({ campaign, onChanged }: { campaign: Campaign; onChanged: () => void }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState(''), [content, setContent] = useState(false), [fundraising, setFundraising] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(true)
  const [history, setHistory] = useState<Review[]>([]), [historyError, setHistoryError] = useState(''), [total, setTotal] = useState(0), [page, setPage] = useState(1), [retry, setRetry] = useState(0)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  useEffect(() => {
    let current = true
    setHistoryLoading(true); setHistory([]); setHistoryError('')
    api.get<{ items: Review[]; total: number }>(`/campaigns/${campaign.id}/reviews?page=${page}`).then(data => {
      if (current) { setHistory(data.items); setTotal(data.total) }
    }).catch(() => { if (current) setHistoryError('Review history could not load.') }).finally(() => { if (current) setHistoryLoading(false) })
    return () => { current = false }
  }, [campaign.id, page, retry])
  const disabled = busy || notes.trim().length < 20 || !campaign.reviewVersion || user?.id === campaign.creatorId
  async function decide(action: Decision) {
    if (disabled || (action === 'approve' && (!content || !fundraising))) return
    setBusy(true); setError('')
    try {
      await api.put(`/campaigns/${campaign.id}/review`, { action, reason: notes.trim(), expectedVersion: campaign.reviewVersion, contentReviewed: content, fundraisingReviewed: fundraising })
      if (live.current) onChanged()
    } catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : 'Decision could not be saved.') }
    finally { if (live.current) setBusy(false) }
  }
  return <Stack spacing={2} sx={{ p: 2.5, minWidth: 0 }}>
    <Typography variant="h6">Staff decision</Typography>
    <Typography variant="body2">Review the complete story, beneficiary details, public media and organizer evidence before approving. Returning a blocked campaign to review keeps it private.</Typography>
    {campaign.imageUrls.length > 0 && <Box><Typography variant="subtitle2">Public media to inspect</Typography>{campaign.imageUrls.map((url, index) => <Button key={`${index}:${url}`} component="a" href={url} target="_blank" rel="noopener noreferrer">Open attachment {index + 1}</Button>)}</Box>}
    {campaign.status === 'pending_review' && <>
      <FormControlLabel control={<Checkbox checked={content} disabled={busy} onChange={e => setContent(e.target.checked)} />} label="I reviewed the complete public content and every media attachment." />
      <FormControlLabel control={<Checkbox checked={fundraising} disabled={busy} onChange={e => setFundraising(e.target.checked)} />} label="I reviewed organizer verification, beneficiary authority, goal and applicable fundraising requirements." />
    </>}
    <TextField label="Decision notes (at least 20 characters)" multiline minRows={3} value={notes} disabled={busy} onChange={e => setNotes(e.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
    {user?.id === campaign.creatorId && <Alert severity="info">Another administrator must review your campaign.</Alert>}
    {!campaign.reviewVersion && <Alert severity="warning">Reload the campaign to obtain its current review version.</Alert>}
    {error && <Alert severity="error" action={<Button color="inherit" onClick={onChanged}>Reload</Button>}>{error}</Alert>}
    <Stack spacing={1}>
      {campaign.status === 'pending_review' && <><Button variant="contained" disabled={disabled || !content || !fundraising} onClick={() => void decide('approve')}>Approve campaign</Button><Button color="error" disabled={disabled} onClick={() => void decide('reject')}>Reject campaign</Button></>}
      {campaign.status === 'blocked' ? <Button disabled={disabled} onClick={() => void decide('reopen')}>Return to review</Button> : <Button color="error" disabled={disabled} onClick={() => void decide('block')}>Block campaign</Button>}
    </Stack>
    {busy && <Typography role="status">Saving decision and audit record…</Typography>}
    <Typography variant="h6">Review history</Typography>
    <ExportMenu title="Campaign review history" disabled={historyLoading || !!historyError} getReport={async progress => ({ title: 'Campaign review history', filters: [`Campaign: ${campaign.id}`], tables: [exportTable('Decisions', await loadAll<Review>(`/campaigns/${campaign.id}/reviews`, progress), { ID: r => r.id, Version: r => r.version, Reviewer: r => r.actorId, Decision: r => r.action, Before: r => r.beforeStatus, After: r => r.afterStatus, Notes: r => r.reason, Date: r => dateCell(r.createdAt), Title: r => r.snapshot?.title, Story: r => r.snapshot?.description, Beneficiaries: r => r.snapshot?.beneficiaries.join(', '), Goal: r => r.snapshot?.goalAmount, Currency: r => r.snapshot?.currency, URL: r => r.snapshot?.slug, Media: r => r.snapshot?.imageUrls.join('\n') })] })} />
    {historyError ? <Alert severity="error" action={<Button onClick={() => setRetry(n => n + 1)}>Retry</Button>}>{historyError}</Alert> : history.map(item => <Box key={item.id} sx={{ overflowWrap: 'anywhere', borderTop: '1px solid', borderColor: 'divider', pt: 1 }}><Typography fontWeight={700}>{item.action} · {item.beforeStatus} → {item.afterStatus}</Typography><Typography variant="body2">{item.reason}</Typography><Typography variant="caption">{item.actorId} · {new Date(item.createdAt).toLocaleString()}</Typography><Typography variant="caption" display="block">Version {item.version}</Typography>{item.snapshot && <Box component="details" sx={{ mt: 1 }}><Typography component="summary" sx={{ cursor: 'pointer' }}>Reviewed content</Typography><Typography fontWeight={700}>{item.snapshot.title}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.snapshot.description}</Typography><Typography>Beneficiaries: {item.snapshot.beneficiaries.join(', ') || 'None listed'}</Typography><Typography>Goal: {item.snapshot.currency} {item.snapshot.goalAmount.toLocaleString()}</Typography><Typography>URL: {item.snapshot.slug || 'None'}</Typography>{item.snapshot.imageUrls.map((url, index) => <Button key={`${index}:${url}`} component="a" href={url} target="_blank" rel="noopener noreferrer">Reviewed attachment {index + 1}</Button>)}</Box>}{item.snapshotErasedAt && <Typography variant="caption">Duplicate content evidence removed on account closure.</Typography>}</Box>)}
    {historyLoading && <Typography role="status">Loading review history…</Typography>}
    {!historyLoading && !historyError && !history.length && <Typography variant="body2">No recorded decisions on this page.</Typography>}
    <Stack direction="row"><Button disabled={historyLoading || page === 1} onClick={() => setPage(n => n - 1)}>Previous decisions</Button><Button disabled={historyLoading || page * 25 >= total} onClick={() => setPage(n => n + 1)}>Next decisions</Button></Stack>
  </Stack>
}
