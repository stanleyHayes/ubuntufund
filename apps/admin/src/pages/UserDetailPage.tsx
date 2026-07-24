import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import Button from '@mui/material/Button'
import { keyframes } from '@mui/system'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import BlockIcon from '@mui/icons-material/Block'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import { useMockUser, useMockUserCampaigns, useMockUserDonations } from '@/hooks/useMockData'
import { VerificationLevel, UserRole } from '@ubuntu-fund/types'
import { ItemNotFound, EmptyState } from '@ubuntu-fund/ui'
import PageHeader from '@/components/PageHeader'

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

const roleColors: Record<string, string> = {
  [UserRole.ADMIN]: '#C06B58',
  [UserRole.ORGANIZATION]: '#7D3223',
  [UserRole.USER]: '#74909A',
}

const verificationSteps = [
  { level: VerificationLevel.NONE, label: 'None' },
  { level: VerificationLevel.EMAIL_PHONE, label: 'Email' },
  { level: VerificationLevel.NATIONAL_ID, label: 'NatID' },
  { level: VerificationLevel.INSTITUTIONAL, label: 'Institutional' },
  { level: VerificationLevel.COMMUNITY, label: 'Community' },
]

function trustColor(score: number): string {
  if (score >= 70) return '#5E8F72'
  if (score >= 40) return '#D3A95C'
  return '#C06B58'
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useMockUser(id ?? '')
  const userCampaigns = useMockUserCampaigns(id ?? '')
  const userDonations = useMockUserDonations(id ?? '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const navigate = useNavigate()

  if (loading) {
    return (
      <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' } }}>
          {[0, 1, 2, 3].map(i => (
            <Box key={i} sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
              <Skel w={80} h={10} />
              <Box sx={{ mt: 1.5 }}><Skel w={120} h={28} /></Box>
              <Box sx={{ mt: 1 }}><Skel w={60} h={10} /></Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 1fr' } }}>
          <Box sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Skel w={64} h={64} />
              <Box sx={{ flex: 1 }}><Skel w={180} h={20} /><Box sx={{ mt: 1 }}><Skel w={200} h={14} /></Box></Box>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[0, 1, 2, 3].map(i => <Box key={i}><Skel w={90} h={10} /><Box sx={{ mt: 0.5 }}><Skel w={140} h={14} /></Box></Box>)}
            </Box>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              {[0, 1, 2, 3, 4].map(i => <Box key={i} sx={{ flex: 1 }}><Skel h={24} /></Box>)}
            </Box>
          </Box>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            {[0, 1, 2].map(i => <Box key={i} sx={{ mb: 1.5 }}><Skel h={40} /></Box>)}
            <Box sx={{ mt: 2 }}><Skel w={80} h={40} /></Box>
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {[0, 1].map(i => (
            <Box key={i} sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
              <Skel w={100} h={12} />
              <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[0, 1, 2, 3].map(j => <Box key={j}><Skel h={60} /></Box>)}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  if (!user) {
    return (
      <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ItemNotFound itemType="User" onBack={() => navigate('/users')} backLabel="Back to Users" />
      </Box>
    )
  }

  const roleColor = roleColors[user.role] || '#74909A'
  const initials = user.name.split(' ').map(n => n[0]).join('')

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.4s ease` }}>
      <Box sx={{ px: 2.5, pt: 2.5 }}>
        <PageHeader
          tone="gold"
          eyebrow="Community · User"
          title={user.name}
          lede="Review this member's trust signals, verification progress, and giving history."
          icon={<PeopleRoundedIcon />}
          stats={[
            { label: 'Role', value: user.role.toUpperCase() },
            { label: 'Trust Score', value: user.trustScore },
            { label: 'Campaigns', value: userCampaigns.length },
            { label: 'Donations', value: userDonations.length },
          ]}
        />
      </Box>

      {/* Main content */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 1fr' } }}>
        {/* Left: User profile */}
        <Box sx={{
          p: 2.5,
          borderRight: `1px solid ${B}`,
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.25s both`,
        }}>
          {/* Avatar + Email */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{
              width: 64, height: 64,
              bgcolor: roleColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: 700, color: '#fff',
              fontFamily: '"Outfit", sans-serif',
            }}>
              {initials}
            </Box>
            <Typography sx={{ fontSize: '0.82rem', color: '#A0A0B0' }}>
              {user.email}
            </Typography>
          </Box>

          {/* Separator */}
          <Box sx={{ borderBottom: `1px solid ${B}`, mb: 2 }} />

          {/* Info grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', mb: 2.5 }}>
            {[
              { label: 'Country', value: user.country ?? 'Unknown' },
              { label: 'Verification Level', value: verificationSteps.find(v => v.level === user.verificationLevel)?.label ?? 'None' },
              { label: 'Joined', value: new Date(user.createdAt).toLocaleDateString() },
              { label: 'Role', value: user.role.toUpperCase() },
            ].map((item, i) => (
              <Box key={i}>
                <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 0.8, mb: 0.3 }}>
                  {item.label}
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', color: '#E0E0E8' }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Verification progress */}
          <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 0.8, mb: 1 }}>
            Verification Progress
          </Typography>
          <Box sx={{ display: 'flex', gap: 0 }}>
            {verificationSteps.map((step, i) => {
              const filled = user.verificationLevel >= step.level
              return (
                <Box
                  key={i}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    borderRight: i < verificationSteps.length - 1 ? `1px solid ${B}` : 'none',
                    p: 1,
                    bgcolor: filled ? 'rgba(94,143,114,0.1)' : 'transparent',
                    borderTop: filled ? '2px solid rgba(94,143,114,0.4)' : `2px solid ${B}`,
                  }}
                >
                  <Typography sx={{ fontSize: '0.65rem', color: filled ? '#5E8F72' : '#6B6B80', fontWeight: filled ? 600 : 400 }}>
                    {step.label}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Right: Actions */}
        <Box sx={{
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.3s both`,
          display: 'flex', flexDirection: 'column',
        }}>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<VerifiedUserIcon />}
              sx={{
                color: '#5E8F72', borderColor: '#5E8F72',
                fontFamily: '"Outfit", sans-serif', textTransform: 'none',
                '&:hover': { borderColor: '#5E8F72', bgcolor: 'rgba(94,143,114,0.08)' },
              }}
            >
              Verify User
            </Button>
          </Box>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PauseCircleOutlineIcon />}
              sx={{
                color: '#D3A95C', borderColor: '#D3A95C',
                fontFamily: '"Outfit", sans-serif', textTransform: 'none',
                '&:hover': { borderColor: '#D3A95C', bgcolor: 'rgba(211,169,92,0.08)' },
              }}
            >
              Suspend
            </Button>
          </Box>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<BlockIcon />}
              sx={{
                color: '#C06B58', borderColor: '#C06B58',
                fontFamily: '"Outfit", sans-serif', textTransform: 'none',
                '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
              }}
            >
              Ban
            </Button>
          </Box>
          {/* Trust Score display */}
          <Box sx={{ p: 2.5, flex: 1 }}>
            <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 0.8, mb: 0.5 }}>
              Trust Score
            </Typography>
            <Typography sx={{ fontSize: '2.4rem', fontWeight: 700, color: trustColor(user.trustScore), fontFamily: '"Outfit", monospace', lineHeight: 1 }}>
              {user.trustScore}
            </Typography>
            <Box sx={{ mt: 1.5, width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.04)' }}>
              <Box sx={{
                height: '100%', width: `${user.trustScore}%`,
                bgcolor: trustColor(user.trustScore),
                transition: 'width 0.6s ease',
              }} />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Bottom: Two side-by-side grids */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {/* Campaigns */}
        <Box sx={{ borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 1, fontFamily: '"Outfit", sans-serif' }}>
              Campaigns ({userCampaigns.length})
            </Typography>
          </Box>
          {userCampaigns.length === 0 ? (
            <EmptyState variant="noData" title="No campaigns" description="This user hasn't created any campaigns." compact />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {userCampaigns.slice(0, 6).map((c, i) => (
                <Box
                  key={c.id}
                  sx={{
                    p: 2,
                    borderRight: `1px solid ${B}`,
                    borderBottom: `1px solid ${B}`,
                    borderTop: '2px solid rgba(125,50,35,0.25)',
                    borderLeft: '2px solid rgba(125,50,35,0.25)',
                    animation: `${slideIn} 0.4s ease ${0.35 + i * 0.04}s both`,
                    transition: 'background 0.2s',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#E0E0E8', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: '#6B6B80', textTransform: 'uppercase' }}>
                    {c.status.replace('_', ' ')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', fontFamily: '"Outfit", monospace', mt: 0.5 }}>
                    GH₵ {c.raisedAmount.toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Donations */}
        <Box sx={{ borderBottom: `1px solid ${B}` }}>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 1, fontFamily: '"Outfit", sans-serif' }}>
              Donations ({userDonations.length})
            </Typography>
          </Box>
          {userDonations.length === 0 ? (
            <EmptyState variant="noData" title="No donations" description="This user hasn't made any donations." compact />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {userDonations.slice(0, 6).map((d, i) => (
                <Box
                  key={d.id}
                  sx={{
                    p: 2,
                    borderRight: `1px solid ${B}`,
                    borderBottom: `1px solid ${B}`,
                    borderTop: '2px solid rgba(116,144,154,0.25)',
                    borderLeft: '2px solid rgba(116,144,154,0.25)',
                    animation: `${slideIn} 0.4s ease ${0.35 + i * 0.04}s both`,
                    transition: 'background 0.2s',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}
                >
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#fff', fontFamily: '"Outfit", monospace' }}>
                    GH₵ {d.amount.toLocaleString()}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: '#A0A0B0', mt: 0.3 }}>
                    {d.campaignId}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#6B6B80', mt: 0.3 }}>
                    {new Date(d.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
