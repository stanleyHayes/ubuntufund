import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Alert, Box, Button, Chip, Skeleton, Typography } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import { Action, type Resource } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAdminPermissions } from './AdminPermissionContext'

type Item = { id: string; title: string; href: string; resource: Resource; count: number }
const Context = createContext({
  items: [] as Item[],
  total: 0,
  loading: true,
  error: '',
  refresh: () => {},
})
export function AdminActionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { can } = useAdminPermissions()
  const { pathname } = useLocation()
  const refresh = useCallback(() => {
    void api
      .get<{ items: Item[] }>('/admin/action-center')
      .then((data) => {
        setItems(data.items)
        setError('')
      })
      .catch(() => setError('Action counts could not be loaded.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    refresh()
  }, [pathname, refresh])
  useEffect(() => {
    const update = () => {
      if (!document.hidden) refresh()
    }
    const timer = setInterval(update, 30000)
    window.addEventListener('focus', update)
    window.addEventListener('ujimora:admin-actions-changed', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
      window.removeEventListener('ujimora:admin-actions-changed', update)
    }
  }, [refresh])
  const visible = items.filter((item) => can(item.resource, Action.READ))
  return (
    <Context.Provider
      value={{
        items: visible,
        total: visible.reduce((sum, item) => sum + item.count, 0),
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  )
}
export const useAdminActions = () => useContext(Context)
export function AdminActionInbox() {
  const { items, loading, error, refresh } = useAdminActions()
  return (
    <Box sx={{ my: 2 }}>
      <Typography variant="overline">Needs attention</Typography>
      {error ? (
        <Alert severity="warning" action={<Button onClick={refresh}>Retry</Button>}>
          {error}
        </Alert>
      ) : loading ? (
        <Skeleton height={70} />
      ) : (
        <>
          {!items.some((item) => item.count > 0) && (
            <Typography variant="body2" color="text.secondary">
              No pending reviews.
            </Typography>
          )}
          {items
            .filter((item) => item.count > 0)
            .map((item) => (
              <Button
                key={item.id}
                component={Link}
                to={item.href}
                fullWidth
                sx={{ justifyContent: 'space-between', gap: 2, my: 0.75, px: 1.5, py: 1 }}
              >
                <span>{item.title}</span>
                <Chip size="small" label={item.count} />
              </Button>
            ))}
        </>
      )}
    </Box>
  )
}
