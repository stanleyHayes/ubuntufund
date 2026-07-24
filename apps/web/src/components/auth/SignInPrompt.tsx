import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { EmptyState, SHAPE } from '@ubuntu-fund/ui'

const FOREST = '#2E3D2F'

/**
 * Friendly "sign in to continue" panel shown on protected pages when the user
 * is not authenticated — instead of a bare redirect, a blank screen, or an
 * endless spinner. Reuses the shared EmptyState so it looks like a sibling of
 * every other empty state in the app: a centered tinted icon tile, a bold
 * title, a muted subtitle, and a primary CTA.
 */
export function SignInPrompt({
  title = 'Sign in to continue',
  description = 'This page is only available to signed-in members. Sign in to pick up right where you left off.',
}: {
  title?: string
  description?: string
}) {
  const location = useLocation()

  return (
    <Box
      sx={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <EmptyState
        icon={
          <Box
            aria-hidden
            sx={{
              width: 72,
              height: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: SHAPE.card,
              bgcolor: 'rgba(46, 61, 47, 0.08)',
              color: FOREST,
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 34 }} />
          </Box>
        }
        title={title}
        description={description}
        action={
          <Button
            component={RouterLink}
            to="/login"
            state={{ from: location }}
            variant="contained"
            color="primary"
            sx={{ borderRadius: SHAPE.sm, px: 4, fontWeight: 700 }}
          >
            Sign In
          </Button>
        }
      />
    </Box>
  )
}
