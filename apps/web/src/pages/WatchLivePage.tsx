import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import { Button, CurrencyDisplay, SHAPE } from '@ubuntu-fund/ui'
import { getLiveSessionPublic, type LiveSessionPublicView } from '@/lib/fundraising'
import { LiveVideoPanel } from '@/components/live/LiveVideoPanel'
import { useSeo } from '@/lib/seo'

export function WatchLivePage() {
  const { sessionId } = useParams()
  // A broadcast exists only while it is running; indexing one guarantees a
  // result that is dead by the time anyone clicks it.
  useSeo({
    title: 'Live fundraiser | Ujimora',
    description: 'Watch a live fundraiser on Ujimora and give as it happens.',
    path: `/live/${encodeURIComponent(sessionId ?? '')}`,
    robots: 'noindex, follow',
  })
  const [session, setSession] = useState<LiveSessionPublicView | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!sessionId) return
    let stopped = false
    const load = async () => {
      try { const value = await getLiveSessionPublic(sessionId); if (!stopped) { setSession(value); setError(value ? '' : 'This broadcast was not found.') } }
      catch (err) { if (!stopped) setError(err instanceof Error ? err.message : 'Could not load broadcast.') }
    }
    void load(); const timer = setInterval(load, 10000)
    return () => { stopped = true; clearInterval(timer) }
  }, [sessionId])
  return <Container maxWidth="lg" sx={{ py: 5 }}>
    <Typography component="h1" variant="h4" sx={{ fontWeight: 800, mb: 3 }}>{session?.title || 'Live on Ujimora'}</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!session && !error && <Skeleton variant="rounded" height={400} />}
    {session && <>
      {session.status === 'active' ? <LiveVideoPanel sessionId={session.id} /> : <Alert severity="info">This broadcast has ended. You can still support the campaign.</Alert>}
      <Box sx={{ mt: 3, p: 3, bgcolor: 'var(--neu-surface)', border: 'var(--neu-border)', boxShadow: 'var(--neu-raised)', borderRadius: SHAPE.card, backdropFilter: 'var(--neu-backdrop)' }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Together, during this broadcast</Typography>
        {session.amountRaised !== null && <CurrencyDisplay amount={session.amountRaised} currency={session.currency ?? 'GHS'} sx={{ fontSize: '1.75rem', fontWeight: 800 }} />}
        <Typography sx={{ color: 'text.secondary' }}>{session.successfulDonations} {session.successfulDonations === 1 ? 'donation' : 'donations'}{session.status === 'active' ? ' · Updates every few seconds' : ''}</Typography>
      </Box>
      <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button component="a" href={`/c/${session.campaignId}/donate${session.status === 'active' ? `?liveSessionId=${encodeURIComponent(session.id)}` : ''}`} brandVariant="primary">Support this campaign</Button>
        <Button component="a" href={`/c/${session.campaignId}`} brandVariant="outline">View campaign</Button>
      </Box>
    </>}
  </Container>
}
