import TaskAltRounded from '@mui/icons-material/TaskAltRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
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
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2,
                mt: 1,
                borderRadius: 'var(--shape-card, 16px)',
                bgcolor: 'var(--neu-surface)',
                boxShadow: 'var(--neu-subtle)',
              }}
            >
              <TaskAltRounded
                aria-hidden="true"
                sx={{ color: 'text.secondary', fontSize: 26, flexShrink: 0 }}
              />
              <Box sx={{ position: 'relative' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
                  Reviews are up to date
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  No pending items need your attention.
                </Typography>
              </Box>
              <TaskAltRounded
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  right: -12,
                  bottom: -22,
                  fontSize: 105,
                  opacity: 0.045,
                  transform: 'rotate(-18deg)',
                  pointerEvents: 'none',
                }}
              />
            </Box>
          )}
          {items
            .filter((item) => item.count > 0)
            .map((item) => (
              <Button
                key={item.id}
                component={Link}
                to={item.href}
                fullWidth
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  justifyContent: 'space-between',
                  gap: 2,
                  my: 1,
                  px: 2,
                  py: 1.5,
                  boxShadow: 'var(--neu-subtle)',
                  bgcolor: 'var(--neu-surface)',
                }}
              >
                <ArrowForwardRounded
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    right: 12,
                    fontSize: 85,
                    opacity: 0.04,
                    transform: 'rotate(-35deg)',
                    pointerEvents: 'none',
                  }}
                />
                <span>{item.title}</span>
                <Chip size="small" label={item.count} />
              </Button>
            ))}
        </>
      )}
    </Box>
  )
}
