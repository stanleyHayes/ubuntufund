import { useState } from 'react'
import { Alert, Box, Button } from '@mui/material'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { ReportContent } from './ReportContent'
export function UserSafetyControls({ userId, onBlocked, liveSessionId }: { userId: string; onBlocked: () => void; liveSessionId?: string }) {
  const { user } = useAuth()
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  if (!user || !userId || user.id === userId) return null
  async function block() {
    setBusy(true); setError('')
    try { await api.put(`/safety/blocks/${userId}`, {}); onBlocked() }
    catch { setError('Could not block this user. Please try again.') }
    finally { setBusy(false) }
  }
  return <Box><ReportContent userId={userId} liveSessionId={liveSessionId} /><Button disabled={busy} onClick={() => void block()}>Block user</Button>{error && <Alert severity="error">{error}</Alert>}</Box>
}
