import { EmptyState } from './EmptyState'
import LinkRounded from '@mui/icons-material/LinkRounded'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Alert, Badge, Box, Button, IconButton, Popover, Skeleton, Typography } from '@mui/material'
import NotificationsRounded from '@mui/icons-material/NotificationsRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'

type Notice = { id: string; title: string; message: string; read: boolean; createdAt: string }
type NotificationApi = { get<T>(path: string): Promise<T>; put<T>(path: string): Promise<T> }
export function NotificationBell({
  api,
  attentionCount = 0,
  children,
}: {
  api: NotificationApi
  attentionCount?: number
  children?: ReactNode
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [items, setItems] = useState<Notice[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try {
      const [notices, count] = await Promise.all([
        api.get<Notice[]>('/notifications'),
        api.get<{ count: number }>('/notifications/unread-count'),
      ])
      setItems(notices)
      setUnread(count.count)
      setError('')
    } catch {
      setError('Notifications could not be loaded. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [api])
  useEffect(() => {
    let active = true
    const update = () => {
      if (active && !document.hidden) void refresh()
    }
    update()
    const timer = setInterval(update, 30000)
    window.addEventListener('focus', update)
    window.addEventListener('ujimora:notifications-changed', update)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', update)
      window.removeEventListener('ujimora:notifications-changed', update)
    }
  }, [refresh])
  async function markRead(id?: string) {
    setBusy(true)
    try {
      await api.put(id ? `/notifications/${id}/read` : '/notifications/read-all')
      await refresh()
      window.dispatchEvent(new Event('ujimora:notifications-changed'))
    } catch {
      setError('Could not update notifications. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <IconButton
        sx={{
          flexShrink: 0,
          bgcolor: 'var(--neu-surface)',
          boxShadow: 'var(--neu-subtle)',
          borderRadius: 'var(--shape-button, 10px)',
        }}
        aria-label={`Notifications (${unread} unread${attentionCount ? `, ${attentionCount} actions pending` : ''})`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        data-tour="bell"
        onClick={(event) => {
          setAnchor(event.currentTarget)
          void refresh()
        }}
      >
        <Badge badgeContent={unread + attentionCount} color="secondary" max={99}>
          <NotificationsRounded />
        </Badge>
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'Notifications',
            sx: {
              width: 400,
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: '75dvh',
              mt: 1,
              borderRadius: 'var(--shape-card, 18px) !important',
              bgcolor: 'var(--neu-surface)',
              boxShadow: 'var(--neu-raised)',
            },
          },
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
              pb: 2.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <NotificationsRounded
              aria-hidden="true"
              sx={{
                position: 'absolute',
                right: 44,
                top: -25,
                fontSize: 132,
                opacity: 0.045,
                transform: 'rotate(-18deg)',
                pointerEvents: 'none',
              }}
            />
            <Box sx={{ position: 'relative' }}>
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', letterSpacing: '.15em', fontSize: 10 }}
              >
                Your activity
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Notifications
              </Typography>
            </Box>
            <IconButton
              sx={{
                flexShrink: 0,
                bgcolor: 'var(--neu-surface)',
                boxShadow: 'var(--neu-subtle)',
                borderRadius: 'var(--shape-button, 10px)',
              }}
              aria-label="Close notifications"
              onClick={() => setAnchor(null)}
            >
              <CloseRounded />
            </IconButton>
          </Box>
          <Box
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) setAnchor(null)
            }}
          >
            {children}
          </Box>
          {error && (
            <Alert severity="error" action={<Button onClick={() => void refresh()}>Retry</Button>}>
              {error}
            </Alert>
          )}
          {loading ? (
            <Box role="status" aria-label="Loading notifications">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={70} />
              ))}
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 1,
                }}
              >
                <Typography variant="overline">Your inbox</Typography>
                {unread > 0 && (
                  <Button size="small" disabled={busy} onClick={() => void markRead()}>
                    Mark all read
                  </Button>
                )}
              </Box>
              {!error && !items.length && (
                <Box
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    mt: 1.5,
                    borderRadius: 'var(--shape-card, 18px)',
                    '& > .MuiBox-root': { boxSizing: 'border-box', bgcolor: 'var(--neu-surface)' },
                  }}
                >
                  <LinkRounded
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      right: -32,
                      bottom: -28,
                      fontSize: 180,
                      zIndex: 1,
                      transform: 'rotate(-35deg)',
                      color: 'text.secondary',
                      opacity: 0.045,
                      pointerEvents: 'none',
                    }}
                  />
                  <EmptyState
                    compact
                    title="You’re all caught up"
                    description="Your donations, campaign updates and account news will appear here."
                  />
                </Box>
              )}
              {items.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    p: 2,
                    my: 1.5,
                    boxShadow: 'var(--neu-subtle)',
                    borderRadius: 2,
                    bgcolor: item.read ? 'transparent' : 'action.hover',
                  }}
                >
                  <NotificationsRounded
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      right: -12,
                      bottom: -14,
                      fontSize: 90,
                      opacity: 0.035,
                      transform: 'rotate(-18deg)',
                      pointerEvents: 'none',
                    }}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: item.read ? 500 : 800 }}>
                    {!item.read && (
                      <Box
                        component="span"
                        aria-label="Unread"
                        sx={{
                          display: 'inline-block',
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          bgcolor: 'secondary.main',
                          mr: 1,
                        }}
                      />
                    )}
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ my: 0.5, overflowWrap: 'anywhere' }}>
                    {item.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(item.createdAt).toLocaleString()}
                  </Typography>
                  {!item.read && (
                    <Button size="small" disabled={busy} onClick={() => void markRead(item.id)}>
                      Mark as read
                    </Button>
                  )}
                </Box>
              ))}
            </>
          )}
        </Box>
      </Popover>
    </>
  )
}
