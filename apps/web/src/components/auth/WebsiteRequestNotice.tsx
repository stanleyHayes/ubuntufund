import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Link from '@mui/material/Link'
import Button from '@mui/material/Button'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export function WebsiteRequestNotice() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated || user?.role !== 'organization') return null
  return <RequestNotice key={user.id} initialRequested={!!user.needsWebsite} />
}

function RequestNotice({ initialRequested }: { initialRequested: boolean }) {
  const [requested, setRequested] = useState(initialRequested)
  const [withdrawn, setWithdrawn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const didWithdraw = useRef(false)
  useEffect(() => {
    let active = true
    void api.get<{ needsWebsite: boolean }>('/profile/website-request').then(result => { if (active && !didWithdraw.current) setRequested(result.needsWebsite) }).catch(() => {})
    return () => { active = false }
  }, [])
  async function withdraw() {
    setBusy(true); setError('')
    try { await api.post('/profile/website-request/withdraw'); didWithdraw.current = true; setRequested(false); setWithdrawn(true) }
    catch { setError('Could not withdraw your request. Please try again.') }
    finally { setBusy(false) }
  }
  if (withdrawn) return <Alert severity="success" sx={{ m: { xs: 2, md: 3 } }}>Your website-contact request has been withdrawn. For contact already underway, email <Link href="mailto:info@neurodyne.dev">info@neurodyne.dev</Link>.</Alert>
  if (!requested) return null

  return (
    <Alert severity="info" sx={{ m: { xs: 2, md: 3 }, overflowWrap: 'anywhere' }}>
      <AlertTitle>Your website request is saved</AlertTitle>
      Our parent company, Neurodyne Corp Ltd, will contact you about a website for your organization.{' '}
      Visit <Link href="https://neurodyne.dev" target="_blank" rel="noopener noreferrer">neurodyne.dev</Link>{' '}
      or email <Link href="mailto:info@neurodyne.dev">info@neurodyne.dev</Link>.
      <Button disabled={busy} onClick={() => void withdraw()} sx={{ display: 'block', mt: 1 }}>{busy ? 'Withdrawing…' : 'Withdraw website request'}</Button>
      {error && <span role="alert">{error}</span>}
    </Alert>
  )
}
