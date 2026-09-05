import { Alert, Box, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { SHAPE } from '@ubuntu-fund/ui'
import { TONES } from '@/lib/tones'
import { LineChart } from '@mui/x-charts/LineChart'
import { PieChart } from '@mui/x-charts/PieChart'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import { useAdminCampaigns, useAdminReports } from '@/hooks/useApiData'
import { CampaignStatus } from '@ubuntu-fund/types'
import PageHeader from '@/components/PageHeader'

const panelSx = {
  minWidth: 0,
  p: 2.5,
  borderRadius: SHAPE.card,
  bgcolor: 'background.paper',
  boxShadow: 'var(--neu-raised)',
}

const chartSx = {
  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'divider' },
  '& .MuiChartsAxis-tickLabel': { fill: 'text.secondary' },
}

function ReportPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" aria-label={title} sx={panelSx}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>{title}</Typography>
      {children}
    </Box>
  )
}

function EmptyReport({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ p: 3, borderRadius: SHAPE.sm, boxShadow: 'var(--neu-inset)' }}>
      <Typography variant="body2" color="text.secondary">{children}</Typography>
    </Box>
  )
}

const statusBarColors: Record<string, string> = {
  [CampaignStatus.ACTIVE]: '#5E8F72',
  [CampaignStatus.PENDING_REVIEW]: '#D3A95C',
  [CampaignStatus.FUNDED]: '#74909A',
  [CampaignStatus.EXPIRED]: '#78909C',
  [CampaignStatus.BLOCKED]: '#C06B58',
}

export default function ReportsPage() {
  // Real campaign data drives the "Campaign Status Breakdown" panel below.
  const { data: campaigns, isLoading: campaignsLoading, error: campaignsError } = useAdminCampaigns()
  const { data: reports, isLoading: reportsLoading, error: reportsError } = useAdminReports()
  const loading = campaignsLoading || reportsLoading
  const trend = reports.donationTrend
  const categories = reports.categoryBreakdown
  const geoData = reports.geographicData
  const fraudMetrics = reports.fraudMetrics

  const statusBreakdown = [
    { status: 'Active', count: campaigns.filter(c => c.status === CampaignStatus.ACTIVE).length, color: statusBarColors[CampaignStatus.ACTIVE] },
    { status: 'Pending', count: campaigns.filter(c => c.status === CampaignStatus.PENDING_REVIEW).length, color: statusBarColors[CampaignStatus.PENDING_REVIEW] },
    { status: 'Funded', count: campaigns.filter(c => c.status === CampaignStatus.FUNDED).length, color: statusBarColors[CampaignStatus.FUNDED] },
    { status: 'Expired', count: campaigns.filter(c => c.status === CampaignStatus.EXPIRED).length, color: statusBarColors[CampaignStatus.EXPIRED] },
    { status: 'Blocked', count: campaigns.filter(c => c.status === CampaignStatus.BLOCKED).length, color: statusBarColors[CampaignStatus.BLOCKED] },
  ]
  const maxStatusCount = Math.max(...statusBreakdown.map(s => s.count), 1)

  const formatMetricValue = (m: { metric: string; value: number }): string =>
    m.metric.includes('Rate') ? `${m.value}%` : m.metric.includes('Time') ? `${m.value}d` : String(m.value)

  const header = (
    <PageHeader
      tone="green"
      eyebrow="Operations"
      title="Reports"
      lede="Track fraud signals, campaign funding trends, and platform health in one place."
      icon={<AssessmentRoundedIcon />}
      stats={fraudMetrics.map((m) => ({ label: m.metric, value: reportsLoading ? <Skeleton width={60} /> : reportsError ? '—' : formatMetricValue(m) }))}
    />
  )

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      {header}
      {(reportsError || campaignsError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {reportsError && 'Report statistics could not be loaded. '}
          {campaignsError && 'Campaign statistics could not be loaded. '}
          Refresh the page to try again.
        </Alert>
      )}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
        {loading ? [0, 1, 2, 3].map(i => (
          <Box key={i} sx={panelSx}>
            <Skeleton width={180} height={28} />
            <Box sx={{ mt: 2, p: 2, borderRadius: SHAPE.sm, boxShadow: 'var(--neu-inset)' }}>
              <Skeleton variant="rounded" height={250} />
            </Box>
          </Box>
        )) : (
          <>
            <ReportPanel title="Monthly Donation Trends">
              {reportsError ? <EmptyReport>Donation trends are unavailable.</EmptyReport> : trend.length === 0 ? <EmptyReport>No donation history is available yet.</EmptyReport> : (
                <LineChart
                  sx={chartSx}
                  xAxis={[{ data: trend.map(t => t.month), scaleType: 'band' }]}
                  series={[{ data: trend.map(t => t.amount), color: TONES.green.text, area: true, label: 'Donations', valueFormatter: value => value === null ? '—' : `GH₵ ${value.toLocaleString()}` }]}
                  height={280}
                  skipAnimation
                />
              )}
            </ReportPanel>
            <ReportPanel title="Donations by Category">
              {reportsError ? <EmptyReport>Donation categories are unavailable.</EmptyReport> : categories.length === 0 ? <EmptyReport>No category totals are available yet.</EmptyReport> : (
                <PieChart
                  sx={chartSx}
                  colors={[TONES.green.text, TONES.gold.text, TONES.clay.text, TONES.teal.text, TONES.maroon.text, '#B5C9BA', '#DCC07E']}
                  series={[{ data: categories.map((c, i) => ({ id: i, value: c.value, label: c.category })), innerRadius: 48, paddingAngle: 2, cornerRadius: 3 }]}
                  height={280}
                  skipAnimation
                />
              )}
            </ReportPanel>
            <ReportPanel title="Geographic Distribution">
              {reportsError ? <EmptyReport>Geographic totals are unavailable.</EmptyReport> : geoData.length === 0 ? <EmptyReport>No geographic activity is available yet.</EmptyReport> : (
                <TableContainer sx={{ borderRadius: SHAPE.sm, boxShadow: 'var(--neu-inset)' }}>
                  <Table size="small" aria-label="Geographic distribution" sx={{ '& td, & th': { px: 2, py: 1.5 }, '& td': { fontVariantNumeric: 'tabular-nums' } }}>
                    <TableHead><TableRow>
                      <TableCell>Region</TableCell><TableCell align="right">Campaigns</TableCell><TableCell align="right">Donations</TableCell>
                    </TableRow></TableHead>
                    <TableBody>{geoData.map(row => (
                      <TableRow key={row.country} hover>
                        <TableCell component="th" scope="row">{row.country}</TableCell>
                        <TableCell align="right">{row.campaigns}</TableCell>
                        <TableCell align="right">GH₵ {row.donations.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </TableContainer>
              )}
            </ReportPanel>
            <ReportPanel title="Campaign Status Breakdown">
              {campaignsError ? <EmptyReport>Campaign status counts are unavailable.</EmptyReport> : (
                <Box component="dl" sx={{ m: 0, display: 'grid', gap: 2.5 }}>
                  {statusBreakdown.map(s => (
                    <Box key={s.status}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                        <Typography component="dt" variant="body2" color="text.secondary">{s.status}</Typography>
                        <Typography component="dd" sx={{ m: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.count}</Typography>
                      </Box>
                      <Box aria-hidden="true" sx={{ height: 10, p: '2px', borderRadius: SHAPE.bar, boxShadow: 'var(--neu-inset)' }}>
                        <Box sx={{ height: '100%', width: `${(s.count / maxStatusCount) * 100}%`, bgcolor: s.color, borderRadius: SHAPE.bar }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </ReportPanel>
          </>
        )}
      </Box>
    </Box>
  )
}
