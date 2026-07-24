import { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import { keyframes } from '@mui/system'
import { LineChart } from '@mui/x-charts/LineChart'
import { PieChart } from '@mui/x-charts/PieChart'
import {
  useMockData,
  generateDonationTrend,
  generateCategoryBreakdown,
  generateGeographicData,
  generateFraudMetrics,
} from '@/hooks/useMockData'
import { CampaignStatus } from '@ubuntu-fund/types'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

const chartSx = {
  '& .MuiChartsAxis-line': { stroke: B },
  '& .MuiChartsAxis-tick': { stroke: B },
  '& text': { fill: '#A0A0B0 !important', fontSize: '0.72rem !important' },
}

const statusBarColors: Record<string, string> = {
  [CampaignStatus.ACTIVE]: '#5E8F72',
  [CampaignStatus.PENDING_REVIEW]: '#D3A95C',
  [CampaignStatus.FUNDED]: '#74909A',
  [CampaignStatus.EXPIRED]: '#78909C',
  [CampaignStatus.BLOCKED]: '#C06B58',
}

export default function ReportsPage() {
  const { campaigns } = useMockData()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const trend = generateDonationTrend()
  const categories = generateCategoryBreakdown()
  const geoData = generateGeographicData()
  const fraudMetrics = generateFraudMetrics()

  const statusBreakdown = [
    { status: 'Active', count: campaigns.filter(c => c.status === CampaignStatus.ACTIVE).length, color: statusBarColors[CampaignStatus.ACTIVE] },
    { status: 'Pending', count: campaigns.filter(c => c.status === CampaignStatus.PENDING_REVIEW).length, color: statusBarColors[CampaignStatus.PENDING_REVIEW] },
    { status: 'Funded', count: campaigns.filter(c => c.status === CampaignStatus.FUNDED).length, color: statusBarColors[CampaignStatus.FUNDED] },
    { status: 'Expired', count: campaigns.filter(c => c.status === CampaignStatus.EXPIRED).length, color: statusBarColors[CampaignStatus.EXPIRED] },
    { status: 'Blocked', count: campaigns.filter(c => c.status === CampaignStatus.BLOCKED).length, color: statusBarColors[CampaignStatus.BLOCKED] },
  ]
  const maxStatusCount = Math.max(...statusBreakdown.map(s => s.count), 1)

  if (loading) {
    return (
      <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' } }}>
          {[0, 1, 2, 3].map(i => (
            <Box key={i} sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
              <Skel w={100} h={10} />
              <Box sx={{ mt: 1.5 }}><Skel w={80} h={28} /></Box>
              <Box sx={{ mt: 1 }}><Skel w={50} h={10} /></Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
          {[0, 1, 2, 3].map(i => (
            <Box key={i} sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
              <Skel w={160} h={14} />
              <Box sx={{ mt: 2 }}><Skel h={280} /></Box>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.4s ease` }}>
      {/* Top metrics row: Fraud metrics */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' } }}>
        {fraudMetrics.map((m, i) => {
          const isGood = m.change < 0
          const accentColor = isGood ? '#5E8F72' : '#C06B58'
          return (
            <Box
              key={m.metric}
              sx={{
                p: 2.5,
                borderRight: `1px solid ${B}`,
                borderBottom: `1px solid ${B}`,
                borderTop: `2px solid ${accentColor}40`,
                borderLeft: `2px solid ${accentColor}40`,
                animation: `${slideIn} 0.4s ease ${i * 0.06}s both`,
                transition: 'background 0.2s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
              }}
            >
              <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#A0A0B0', letterSpacing: 1, fontFamily: '"TT Squares", sans-serif' }}>
                {m.metric}
              </Typography>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', fontFamily: '"TT Squares", monospace', mt: 0.5, lineHeight: 1.1 }}>
                {m.metric === 'Fraud Rate' ? `${m.value}%` : m.metric === 'Avg Resolution Time' ? `${m.value}d` : m.value}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: accentColor, mt: 0.5, fontWeight: 600 }}>
                {m.change > 0 ? '+' : ''}{m.change}{m.metric === 'Fraud Rate' ? '%' : m.metric === 'Avg Resolution Time' ? 'd' : ''}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* Charts section: 2x2 grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
        {/* Cell 1: Line chart - Monthly Donation Trends */}
        <Box sx={{
          borderRight: `1px solid ${B}`,
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.25s both`,
        }}>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#E0E0E8', fontFamily: '"TT Squares", sans-serif' }}>
              Monthly Donation Trends
            </Typography>
          </Box>
          <Box sx={{ p: 2.5, ...chartSx }}>
            <LineChart
              xAxis={[{ data: trend.map(t => t.month), scaleType: 'band' }]}
              series={[{ data: trend.map(t => t.amount), color: '#5E8F72', area: true }]}
              height={280}
            />
          </Box>
        </Box>

        {/* Cell 2: Pie chart - Donations by Category */}
        <Box sx={{
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.3s both`,
        }}>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#E0E0E8', fontFamily: '"TT Squares", sans-serif' }}>
              Donations by Category
            </Typography>
          </Box>
          <Box sx={{ p: 2.5, ...chartSx }}>
            <PieChart
              series={[{
                data: categories.map((c, i) => ({ id: i, value: c.value, label: c.category })),
              }]}
              height={280}
            />
          </Box>
        </Box>

        {/* Cell 3: Geographic data - table */}
        <Box sx={{
          borderRight: `1px solid ${B}`,
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.35s both`,
        }}>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#E0E0E8', fontFamily: '"TT Squares", sans-serif' }}>
              Geographic Distribution
            </Typography>
          </Box>
          {/* Header row */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${B}` }}>
            {['Country', 'Campaigns', 'Donations'].map((h, i) => (
              <Box key={h} sx={{ px: 2.5, py: 1.2, borderRight: i < 2 ? `1px solid ${B}` : 'none' }}>
                <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 0.8 }}>
                  {h}
                </Typography>
              </Box>
            ))}
          </Box>
          {geoData.map((row, i) => (
            <Box
              key={row.country}
              sx={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                borderBottom: `1px solid ${B}`,
                borderLeft: '2px solid rgba(116,144,154,0.25)',
                transition: 'background 0.2s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
              }}
            >
              <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}` }}>
                <Typography sx={{ fontSize: '0.82rem', color: '#E0E0E8', fontWeight: 600 }}>{row.country}</Typography>
              </Box>
              <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}` }}>
                <Typography sx={{ fontSize: '0.82rem', color: '#A0A0B0', fontFamily: '"TT Squares", monospace' }}>{row.campaigns}</Typography>
              </Box>
              <Box sx={{ px: 2.5, py: 1.5 }}>
                <Typography sx={{ fontSize: '0.82rem', color: '#A0A0B0', fontFamily: '"TT Squares", monospace' }}>${row.donations.toLocaleString()}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Cell 4: Campaign status breakdown */}
        <Box sx={{
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.4s both`,
        }}>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#E0E0E8', fontFamily: '"TT Squares", sans-serif' }}>
              Campaign Status Breakdown
            </Typography>
          </Box>
          {statusBreakdown.map((s) => (
            <Box
              key={s.status}
              sx={{
                px: 2.5, py: 1.8,
                borderBottom: `1px solid ${B}`,
                transition: 'background 0.2s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                <Typography sx={{ fontSize: '0.78rem', color: '#E0E0E8' }}>
                  {s.status}
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', fontFamily: '"TT Squares", monospace' }}>
                  {s.count}
                </Typography>
              </Box>
              <Box sx={{ width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.04)' }}>
                <Box sx={{
                  height: '100%',
                  width: `${(s.count / maxStatusCount) * 100}%`,
                  bgcolor: s.color,
                  transition: 'width 0.6s ease',
                }} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
