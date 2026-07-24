import { useState, type ReactNode } from 'react'
import { Box, Button, Chip, CircularProgress, Snackbar, Alert, Typography } from '@mui/material'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import { ErrorState } from '@ubuntu-fund/ui'
import PageHeader from '@/components/PageHeader'
import type { Tone } from '@/lib/tones'

interface ContentEditorLayoutProps {
  tone?: Tone
  eyebrow: string
  title: string
  lede?: string
  icon?: ReactNode
  loading: boolean
  saving: boolean
  error: string | null
  isDirty: boolean
  /** ISO timestamp of the last persisted save, shown as a subtle caption. */
  updatedAt?: string
  /** Persist the working copy; should resolve on success and throw on failure. */
  onSave: () => Promise<unknown>
  /** Re-fetch the block (used by the error-state retry). */
  onReload: () => void
  /** Skeleton shown while the block loads. */
  skeleton?: ReactNode
  children: ReactNode
}

/**
 * Shared shell for the CMS block editors. Renders the standard PageHeader with
 * a Save action, an unsaved-changes indicator, loading/error handling, and a
 * save toast — so every content editor looks and behaves like a sibling.
 */
export default function ContentEditorLayout({
  tone = 'gold',
  eyebrow,
  title,
  lede,
  icon,
  loading,
  saving,
  error,
  isDirty,
  updatedAt,
  onSave,
  onReload,
  skeleton,
  children,
}: ContentEditorLayoutProps) {
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const handleSave = async () => {
    try {
      await onSave()
      setSnack({ open: true, message: 'Changes saved and live on the marketing site', severity: 'success' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes'
      setSnack({ open: true, message, severity: 'error' })
    }
  }

  const savedCaption = updatedAt
    ? `Last updated ${new Date(updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`
    : undefined

  return (
    <Box>
      <PageHeader
        tone={tone}
        eyebrow={eyebrow}
        title={title}
        lede={lede}
        icon={icon}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {isDirty && !loading && (
              <Chip
                label="Unsaved changes"
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  bgcolor: 'rgba(211,169,92,0.14)',
                  color: '#D3A95C',
                  border: '1px solid rgba(211,169,92,0.28)',
                }}
              />
            )}
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
              onClick={handleSave}
              disabled={loading || saving || !isDirty}
              sx={{ borderRadius: 2, px: 3, fontWeight: 700, textTransform: 'none' }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </Box>
        }
      />

      {savedCaption && !loading && !error && (
        <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary' }}>
          {savedCaption}
        </Typography>
      )}

      {loading ? (
        skeleton ?? <DefaultSkeleton />
      ) : error ? (
        <ErrorState
          title="Couldn't load this content"
          message={error}
          onRetry={onReload}
          retryLabel="Try again"
        />
      ) : (
        children
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function DefaultSkeleton() {
  const HAIRLINE = 'rgba(232, 235, 227, 0.10)'
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Box
          key={i}
          sx={{
            border: `1px solid ${HAIRLINE}`,
            borderRadius: '4px 16px 4px 16px',
            bgcolor: 'background.paper',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Box sx={{ width: '30%', height: 14, borderRadius: 1, bgcolor: 'rgba(232,235,227,0.06)' }} />
          <Box sx={{ width: '100%', height: 40, borderRadius: 1, bgcolor: 'rgba(232,235,227,0.04)' }} />
          <Box sx={{ width: '70%', height: 40, borderRadius: 1, bgcolor: 'rgba(232,235,227,0.04)' }} />
        </Box>
      ))}
    </Box>
  )
}
