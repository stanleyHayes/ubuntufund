import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CircularProgress from '@mui/material/CircularProgress'
import { Link as RouterLink } from 'react-router-dom'
import { formatCurrency, EmptyState, SHAPE } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Refund {
  id: string
  donationId: string
  campaignName: string
  amount: number
  currency: string
  requestDate: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  reason: string
}

const STATUS_CONFIG: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(255,167,38,0.1)', color: '#E65100' },
  processing: { bg: 'rgba(21,101,192,0.08)', color: '#1565C0' },
  completed: { bg: 'rgba(46,125,50,0.08)', color: '#2E7D32' },
  failed: { bg: 'rgba(239,83,80,0.08)', color: '#E53935' },
}

// ---------------------------------------------------------------------------
// MyRefundsPage
// ---------------------------------------------------------------------------

export function MyRefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<Refund[]>('/refunds/mine')
      .then(setRefunds)
      .catch(() => setRefunds([]))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <Box sx={{ bgcolor: '#FAFAF5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: '#FAFAF5', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="lg">
        <Button
          component={RouterLink}
          to="/donations"
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ mb: 3, textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
        >
          Back to Donations
        </Button>

        <Typography
          sx={{
            fontFamily: '"TT Squares", sans-serif',
            fontWeight: 900,
            fontSize: { xs: '1.5rem', md: '1.8rem' },
            mb: 4,
          }}
        >
          My Refund Requests
        </Typography>

        {refunds.length === 0 ? (
          <EmptyState
            variant="noData"
            title="No refund requests"
            description="You haven't requested any refunds yet."
          />
        ) : (
          <TableContainer
            component={Paper}
            sx={{
              borderRadius: SHAPE.card,
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: 'none',
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Refund ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Campaign</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Refund Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Reason</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Request Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {refunds.map((r) => {
                  const statusStyle = STATUS_CONFIG[r.status]
                  return (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem' }}>
                          {r.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {r.campaignName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontFamily: '"TT Squares", monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                          {formatCurrency(r.amount, r.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                          {r.reason}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                          {new Date(r.requestDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            bgcolor: statusStyle.bg,
                            color: statusStyle.color,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  )
}
