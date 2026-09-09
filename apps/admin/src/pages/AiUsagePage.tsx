import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import type { AiUsageLogEntry, AiUsageStats } from '@ubuntu-fund/types'
import PageHeader from '@/components/PageHeader'
import { api } from '@/lib/api'
interface UsagePage {
  data: AiUsageLogEntry[]
  pagination: { total: number; totalPages: number }
}
export default function AiUsagePage() {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [stats, setStats] = useState<AiUsageStats | null>(null)
  const [usage, setUsage] = useState<UsagePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([
      api.get<AiUsageStats>('/ai-writing/stats'),
      api.get<UsagePage>(`/ai-writing/usage?page=${page}&pageSize=20`),
    ])
      .then(([summary, entries]) => {
        if (active) {
          setStats(summary)
          setUsage(entries)
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load AI usage.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [page, revision])
  return (
    <Box>
      <PageHeader
        eyebrow="AI writing"
        title="Writing assistant usage"
        lede="Real requests and provider token usage across Ujimora. Campaign text is never saved in this log."
        icon={<AutoAwesomeRoundedIcon />}
        actions={
          <Button
            disabled={loading}
            onClick={() => {
              setLoading(true)
              setError('')
              setRevision((value) => value + 1)
            }}
          >
            Refresh
          </Button>
        }
        stats={
          stats && !error
            ? [
                { label: 'Total requests', value: stats.totalRequests },
                { label: 'Today (UTC)', value: stats.requestsToday },
                { label: 'This month (UTC)', value: stats.requestsThisMonth },
                {
                  label: 'Input / output tokens',
                  value: `${stats.inputTokens.toLocaleString()} / ${stats.outputTokens.toLocaleString()}`,
                },
                { label: 'Failed requests', value: stats.errors },
              ]
            : undefined
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Stack alignItems="center" sx={{ p: 5 }}>
          <CircularProgress aria-label="Loading AI usage" />
        </Stack>
      ) : (
        !error &&
        stats &&
        usage && (
          <>
            <Alert severity={stats.enabled ? 'success' : 'info'} sx={{ mb: 3 }}>
              {stats.enabled
                ? 'The writing provider is configured. Successful and failed attempts count toward daily limits.'
                : 'AI writing is disabled or missing its provider configuration. Historical usage remains available.'}
            </Alert>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {stats.lastUsedAt
                ? `Last request: ${new Date(stats.lastUsedAt).toLocaleString()}`
                : 'No writing requests yet.'}
            </Typography>
            {usage.data.length === 0 ? (
              <Typography sx={{ p: 3 }}>No requests on this page.</Typography>
            ) : (
              <TableContainer
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 3,
                  boxShadow: 'var(--neu-raised)',
                }}
              >
                <Table aria-label="AI writing usage">
                  <TableHead>
                    <TableRow>
                      {['Time', 'User ID', 'Task', 'Status', 'Model', 'Input / output tokens'].map(
                        (label) => (
                          <TableCell key={label}>{label}</TableCell>
                        ),
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usage.data.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                        <TableCell>{entry.userId}</TableCell>
                        <TableCell>{entry.action.toLowerCase().replaceAll('_', ' ')}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={entry.status}
                            color={
                              entry.status === 'success'
                                ? 'success'
                                : entry.status === 'error'
                                  ? 'error'
                                  : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>{entry.model || '—'}</TableCell>
                        <TableCell>
                          {entry.inputTokens} / {entry.outputTokens}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {usage.pagination.totalPages > 1 && (
              <Pagination
                sx={{ mt: 3 }}
                count={usage.pagination.totalPages}
                page={page}
                onChange={(_, next) => {
                  setLoading(true)
                  setError('')
                  setPage(next)
                }}
              />
            )}
          </>
        )
      )}
    </Box>
  )
}
