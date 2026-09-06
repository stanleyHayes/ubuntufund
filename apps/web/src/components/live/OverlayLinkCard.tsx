// ---------------------------------------------------------------------------
// OverlayLinkCard — surfaces the OBS browser-source URL for a live session.
//
// The overlay URL embeds the session's secret `overlayToken`; the host pastes
// it into OBS as a Browser Source. Copy-to-clipboard, a "rotate token" action
// (revokes the current URL and mints a new one), and short setup instructions.
// Rotating hands the refreshed session back to the parent via `onRotated` so it
// can keep the token it holds in sync.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { Button, SHAPE, LoadingDots } from '@ubuntu-fund/ui'
import { overlayViewUrl, rotateOverlayToken, type LiveSession } from '@/lib/fundraising'

interface OverlayLinkCardProps {
  session: LiveSession
  /** Called with the refreshed session after the overlay token is rotated. */
  onRotated?: (session: LiveSession) => void
}

export function OverlayLinkCard({ session, onRotated }: OverlayLinkCardProps) {
  const [copied, setCopied] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rotated, setRotated] = useState(false)

  const url = overlayViewUrl(session.id, session.overlayToken)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Clipboard is unavailable — select the link and copy it manually.')
    }
  }

  const handleRotate = async () => {
    setError(null)
    setRotating(true)
    try {
      const updated = await rotateOverlayToken(session.id)
      onRotated?.(updated)
      setRotated(true)
      window.setTimeout(() => setRotated(false), 2600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rotate the overlay token.')
    } finally {
      setRotating(false)
    }
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.5 }}>
        <LiveTvRoundedIcon sx={{ color: 'primary.main' }} />
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>OBS overlay</Typography>
      </Stack>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2 }}>
        Add this URL as a <strong>Browser Source</strong> in OBS to show live totals, donation
        alerts, and a goal bar on your stream.
      </Typography>

      <TextField
        label="Overlay URL"
        value={url}
        fullWidth
        size="small"
        InputProps={{
          readOnly: true,
          sx: { fontFamily: 'monospace', fontSize: '0.78rem' },
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={copied ? 'Copied' : 'Copy URL'} arrow>
                <IconButton onClick={handleCopy} edge="end" aria-label="Copy the overlay URL" size="small">
                  {copied ? (
                    <CheckRoundedIcon sx={{ fontSize: 19, color: 'success.main' }} />
                  ) : (
                    <ContentCopyRoundedIcon sx={{ fontSize: 19 }} />
                  )}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        }}
        onFocus={(e) => e.target.select()}
        sx={{ mb: 1.5 }}
      />

      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button
          brandVariant="outline"
          onClick={handleRotate}
          disabled={rotating}
          startIcon={rotating ? <LoadingDots size={6} /> : <RefreshRoundedIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm }}
        >
          Rotate token
        </Button>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', flex: 1, minWidth: 180 }}>
          Rotating invalidates the old link — update the Browser Source afterwards.
        </Typography>
      </Stack>

      {rotated && (
        <Alert severity="success" sx={{ borderRadius: SHAPE.card, mt: 1.5 }}>
          A new overlay URL has been generated. Re-copy it into OBS.
        </Alert>
      )}
      {error && (
        <Alert severity="warning" sx={{ borderRadius: SHAPE.card, mt: 1.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  )
}
