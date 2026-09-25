import { useEffect, useState } from 'react'
import { Alert, Button } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

type MfaStatus = { enabled?: boolean; available?: boolean }

/**
 * Persistent reminder, on every console page, for an administrator whose
 * account has no authenticator sign-in. MFA is not forced here (that could
 * lock out the only administrator); enabling it rotates the session tokens,
 * which re-checks and hides this prompt.
 */
export default function AdminMfaPrompt() {
  const { user, tokens } = useAuth()
  const { pathname } = useLocation()
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const userId = user?.id
  const accessToken = tokens?.accessToken

  useEffect(() => {
    if (!userId) return
    let active = true
    api.get<MfaStatus>('/auth/mfa')
      .then(value => { if (active) setStatus(value) })
      .catch(() => { if (active) setStatus(null) })
    return () => { active = false }
  }, [userId, accessToken])

  if (status?.enabled !== false) return null
  if (status.available === false) {
    return <Alert severity="warning" sx={{ mb: 3 }}>
      Administrator accounts should use authenticator sign-in, but it is not configured on this server yet. Ask engineering to set it up.
    </Alert>
  }
  return <Alert severity="warning" sx={{ mb: 3 }} action={pathname === '/profile' ? undefined : <Button color="inherit" size="small" component={RouterLink} to="/profile?tab=security">Turn on</Button>}>
    Protect this administrator account: turn on authenticator app sign-in. A stolen password alone would give full access to donor data and payouts.
  </Alert>
}
