import { useEffect, useState } from 'react'
import { Alert, Box, Button, Typography } from '@mui/material'
import { api } from '@/lib/api'
export function BlockedUsers({ revision = 0, onChange }: { revision?: number; onChange?: () => void }) {
  const [items, setItems] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    api.get<{ items: typeof items }>('/safety/blocks').then(data => { if (active) { setItems(data.items); setError('') } }).catch(() => { if (active) setError('Could not load blocked users.') })
    return () => { active = false }
  }, [revision, refresh])
  async function unblock(id: string) {
    try { await api.delete(`/safety/blocks/${id}`); setItems(current => current.filter(item => item.id !== id)); setError(''); onChange?.() }
    catch { setError('Could not unblock this user. Please try again.') }
  }
  if (!items.length && !error) return null
  return <Box><Typography variant="subtitle2">Blocked users</Typography>
    <Typography variant="caption">Blocked users’ comments are hidden from each other. Blocking does not submit a moderation report.</Typography>
    {error && <Alert severity="error" action={<Button onClick={() => setRefresh(value => value + 1)}>Retry</Button>}>{error}</Alert>}
    {items.map(item => <Box key={item.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, overflowWrap: 'anywhere' }}><Typography>{item.name}</Typography><Button onClick={() => void unblock(item.id)}>Unblock {item.name}</Button></Box>)}
  </Box>
}
