import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded'
import { Link as RouterLink } from 'react-router-dom'
import { formatCurrency, EmptyState, SHAPE } from '@ubuntu-fund/ui'
import { PaymentMethod } from '@ubuntu-fund/types'
import { useMyDonations } from '@/hooks/useDonations'
import type { UserDonation } from '@/hooks/useDonations'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  completed: { bg: 'rgba(46, 61, 47,0.08)', color: '#2E3D2F' },
  pending: { bg: 'rgba(255,167,38,0.1)', color: '#E65100' },
  refunded: { bg: 'rgba(239,83,80,0.08)', color: '#E53935' },
}

function formatPaymentMethod(method: PaymentMethod): string {
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function isRefundEligible(donation: UserDonation): boolean {
  if (donation.status !== 'completed') return false
  const donationDate = new Date(donation.date)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  return donationDate >= thirtyDaysAgo
}

// ---------------------------------------------------------------------------
// MyDonationsPage
// ---------------------------------------------------------------------------

export function MyDonationsPage() {
  const { donations, isLoading } = useMyDonations()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')

  const filtered = donations.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (methodFilter !== 'all' && d.paymentMethod !== methodFilter) return false
    return true
  })

  const nonRefunded = donations.filter((d) => d.status !== 'refunded')
  const totalDonated = nonRefunded
    .reduce((sum, d) => sum + (d.currency === 'USD' ? d.amount : d.amount * 0.008), 0)
  const campaignsSupported = new Set(donations.map((d) => d.campaignId)).size
  const avgDonation = nonRefunded.length > 0 ? totalDonated / nonRefunded.length : 0

  if (isLoading) {
    return (
      <Box sx={{ bgcolor: '#F2EFEA', minHeight: '100vh', py: 5, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography>Loading donations...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: '#F2EFEA', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="lg">
        <Typography
          sx={{
            fontFamily: '"TT Squares", sans-serif',
            fontWeight: 900,
            fontSize: { xs: '1.5rem', md: '1.8rem' },
            mb: 4,
          }}
        >
          My Donations
        </Typography>

        {/* Stats Bar */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { icon: <TrendingUpRoundedIcon />, label: 'Total Donated (est. USD)', value: `$${Math.round(totalDonated).toLocaleString()}`, color: '#2E3D2F', bg: 'rgba(46, 61, 47,0.08)' },
            { icon: <VolunteerActivismRoundedIcon />, label: 'Campaigns Supported', value: String(campaignsSupported), color: '#1565C0', bg: 'rgba(21,101,192,0.08)' },
            { icon: <BarChartRoundedIcon />, label: 'Average Donation (est. USD)', value: `$${Math.round(avgDonation).toLocaleString()}`, color: '#AD1457', bg: 'rgba(173,20,87,0.08)' },
          ].map((stat) => (
            <Grid size={{ xs: 12, sm: 4 }} key={stat.label}>
              <Box
                sx={{
                  p: 3,
                  borderRadius: SHAPE.card,
                  bgcolor: 'background.paper',
                  border: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: SHAPE.sm,
                    bgcolor: stat.bg,
                    color: stat.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {stat.icon}
                </Box>
                <Box>
                  <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 800, fontSize: '1.3rem' }}>
                    {stat.value}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{stat.label}</Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="refunded">Refunded</MenuItem>
          </TextField>
          <TextField
            select
            label="Payment Method"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">All Methods</MenuItem>
            <MenuItem value={PaymentMethod.MOBILE_MONEY}>Mobile Money</MenuItem>
            <MenuItem value={PaymentMethod.CARD}>Card</MenuItem>
            <MenuItem value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</MenuItem>
            <MenuItem value={PaymentMethod.WALLET}>Wallet</MenuItem>
            <MenuItem value={PaymentMethod.CRYPTO}>Crypto</MenuItem>
          </TextField>
        </Box>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            variant="search"
            title="No donations found"
            description="Adjust your filters or make your first donation to a campaign."
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
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Campaign</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Payment</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((d) => {
                  const statusStyle = STATUS_COLORS[d.status]
                  return (
                    <TableRow key={d.id} hover>
                      <TableCell>
                        <Typography
                          component={RouterLink}
                          to={`/campaigns/${d.campaignId}`}
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: 'text.primary',
                            textDecoration: 'none',
                            '&:hover': { color: 'primary.main' },
                          }}
                        >
                          {d.campaignName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontFamily: '"TT Squares", monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                          {formatCurrency(d.amount, d.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                          {new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            bgcolor: statusStyle.bg,
                            color: statusStyle.color,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                          {formatPaymentMethod(d.paymentMethod)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {isRefundEligible(d) && (
                          <Button
                            component={RouterLink}
                            to={`/donations/refund/${d.id}`}
                            size="small"
                            color="error"
                            sx={{ fontSize: '0.75rem', textTransform: 'none', fontWeight: 600 }}
                          >
                            Request Refund
                          </Button>
                        )}
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
