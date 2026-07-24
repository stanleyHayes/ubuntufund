import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { keyframes } from '@mui/material/styles'
import { api } from '@/lib/api'
import { Link as RouterLink } from 'react-router-dom'

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`

interface KYCData {
  kycStatus: string
  kycLevel: number
  verifications: Array<{
    id: string
    type: string
    status: string
    riskLevel?: string
    createdAt: string
  }>
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  unverified: { color: '#9E9E9E', bg: 'rgba(158,158,158,0.08)', icon: <WarningAmberIcon />, label: 'Unverified' },
  pending: { color: '#B98A2E', bg: 'rgba(185,138,46,0.08)', icon: <WarningAmberIcon />, label: 'Pending Review' },
  verified: { color: '#5E8F72', bg: 'rgba(76,175,80,0.08)', icon: <CheckCircleIcon />, label: 'Verified' },
  rejected: { color: '#A5432F', bg: 'rgba(165,67,47,0.08)', icon: <CancelIcon />, label: 'Rejected' },
  expired: { color: '#9E9E9E', bg: 'rgba(158,158,158,0.08)', icon: <WarningAmberIcon />, label: 'Expired' },
}

const levelLabels: Record<number, string> = {
  0: 'None',
  1: 'Basic',
  2: 'Full',
  3: 'Business',
}

export default function KYCStatus() {
  const [data, setData] = useState<KYCData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchStatus() {
      try {
        const res = await api.get<KYCData>('/kyc/status')
        if (!cancelled) setData(res)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStatus()
    return () => { cancelled = true }
  }, [])

  const status = data?.kycStatus || 'unverified'
  const level = data?.kycLevel || 0
  const config = statusConfig[status] || statusConfig.unverified
  const progress = (level / 3) * 100

  const needed: string[] = []
  if (level < 1) needed.push('Identity verification')
  if (level < 1) needed.push('Address verification')
  if (level < 3) needed.push('Business verification (optional)')

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 3,
        animation: `${fadeIn} 0.4s ease`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{
          width: 44,
          height: 44,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: config.bg,
          color: config.color,
        }}>
          {config.icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
            KYC Status: {config.label}
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
            Level {level} — {levelLabels[level]}
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/kyc"
          variant="outlined"
          size="small"
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          {level === 0 ? 'Start Verification' : 'Update'}
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>Progress</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{level}/3</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'rgba(0,0,0,0.06)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              bgcolor: config.color,
            },
          }}
        />
      </Box>

      {needed.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, mb: 1 }}>Still needed:</Typography>
          {needed.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.2)' }} />
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{item}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {data && data.verifications.length > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, mb: 1 }}>Recent submissions:</Typography>
          {data.verifications.slice(0, 3).map((v) => (
            <Box key={v.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>
                {v.type.replace(/_/g, ' ')}
              </Typography>
              <Typography sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: statusConfig[v.status]?.color || 'text.secondary',
                textTransform: 'uppercase',
              }}>
                {v.status}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  )
}
