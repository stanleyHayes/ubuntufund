import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Typography } from '@mui/material'
import { api } from '@/lib/api'

type Notice = { id: string; title: string; message: string; read: boolean; createdAt: string }
export function OwnerNotifications() {
  const [items, setItems] = useState<Notice[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  useEffect(() => {
    let active = true
    api.get<Notice[]>('/notifications').then(data => { if (active) { setItems(data); setError('') } })
      .catch(() => { if (active) setError('Notifications could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  useEffect(() => {
    const visibleRefresh = () => { if (!document.hidden) refresh() }
    const timer = setInterval(visibleRefresh, 30_000)
    window.addEventListener('focus', visibleRefresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', visibleRefresh) }
  }, [refresh])
  async function markRead(id: string) {
    try { await api.put(`/notifications/${id}/read`); refresh() }
    catch { setError('Could not mark this notification as read. Please try again.') }
  }
  return <Box component="section" aria-label="Notifications" sx={{ p: 3, mb: 3, bgcolor: 'var(--neu-surface)', borderRadius: 3, boxShadow: 'var(--neu-raised)' }}>
    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Notifications</Typography>
    {error && <Alert severity="error" action={<Button onClick={refresh}>Retry</Button>}>{error}</Alert>}
    {loading ? <Typography role="status">Loading notifications…</Typography> : !error && items.length === 0 && <Typography color="text.secondary">New campaign donations will appear here.</Typography>}
    {items.slice(0, 10).map(item => <Box key={item.id} sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>{!item.read && <Chip label="New" size="small" />}</Box>
      <Typography variant="body2" sx={{ my: 0.5 }}>{item.message}</Typography>
      <Typography variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleString()}</Typography>
      {!item.read && <Button size="small" onClick={() => void markRead(item.id)}>Mark as read</Button>}
    </Box>)}
  </Box>
}
