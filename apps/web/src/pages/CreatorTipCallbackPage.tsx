import { useSeo } from '@/lib/seo'
import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Alert, Box, Button, Container, Typography } from '@mui/material'
import { api } from '@/lib/api'
import { DonationCelebration } from '@/components/donate/DonationCelebration'
type Result = { status: string; amount: number; currency: string; handle?: string; displayName?: string; thankYouMessage?: string }
export function CreatorTipCallbackPage() {
  useSeo({
    title: 'Confirming your tip | Ujimora',
    description:
      'Ujimora is checking your tip payment with Paystack. Wait here for the result rather than sending the creator a second payment for the same tip.',
    path: '/tip/callback',
    robots: 'noindex, nofollow',
  })
  const [params] = useSearchParams()
  const reference = params.get('reference') || params.get('trxref') || ''
  const [result, setResult] = useState<Result | null>(null)
  const [stopped, setStopped] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!reference) return
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined; let attempts = 0
    async function check() {
      try {
        const data = await api.post<Result>('/creators/tips/verify', { reference })
        if (!active) return
        setResult(data); setError('')
        if (data.status !== 'PENDING') return
      } catch (e) { if (!active) return; setError(e instanceof Error ? e.message : 'Unable to check payment right now.') }
      if (++attempts >= 20) setStopped(true)
      else timer = setTimeout(() => void check(), 3000)
    }
    void check()
    return () => { active = false; clearTimeout(timer) }
  }, [reference, retry])
  const success = result?.status === 'SUCCEEDED'
  const failed = result?.status === 'FAILED'
  return <Container maxWidth="sm" sx={{ py: { xs: 5, md: 9 } }}><Box sx={{ p: { xs: 3, sm: 5 }, bgcolor: 'background.paper', color: 'text.primary', borderRadius: 4, boxShadow: 'var(--neu-raised)', textAlign: 'center' }}>
    {success && <DonationCelebration />}
    <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>{!reference ? 'Payment reference missing' : success ? 'Thank you for your support!' : failed ? 'Payment was not completed' : stopped ? 'Still confirming your support' : 'Confirming your support…'}</Typography>
    <Typography sx={{ color: 'text.secondary', mb: 3 }}>{success ? `${result.currency} ${result.amount.toFixed(2)} confirmed for ${result.displayName || 'this creator'}. ${result.thankYouMessage || 'Your kindness helps them keep creating.'}` : !reference ? 'Open the return link from your payment checkout to check its status.' : failed ? 'This attempt was not successful. If you see a debit, contact support with your payment reference before trying again.' : 'We are checking securely with Paystack. Please do not pay again while confirmation is pending.'}</Typography>
    {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
    {stopped && <Button onClick={() => { setStopped(false); setError(''); setRetry(r => r + 1) }}>Keep checking</Button>}
    {result?.handle && <Button component={Link} to={`/creators/${encodeURIComponent(result.handle)}`} variant="contained">Back to {result.displayName || 'creator'}</Button>}
    {reference && <Typography variant="caption" component="p" sx={{ mt: 3, overflowWrap: 'anywhere', color: 'text.secondary' }}>Reference: {reference}</Typography>}
  </Box></Container>
}
