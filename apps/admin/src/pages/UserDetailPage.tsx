import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { Alert, Avatar, Box, Chip, LinearProgress, Skeleton, Typography, Button } from '@mui/material'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import { api } from '@/lib/api'
import { useAdminUser, useAdminCampaigns, useAdminDonations } from '@/hooks/useApiData'
import { ItemNotFound, EmptyState, BrandedTextField as TextField, SHAPE } from '@ubuntu-fund/ui'
import { raisedSurface } from '@/lib/surfaces'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'

const panel = { ...raisedSurface, border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)', overflow: 'hidden' }
const verificationLabels = ['Unverified', 'Email / phone', 'National ID', 'Institutional', 'Community']

/** Current compliance limit rendered for display. */
function describeLimit(limit?: number): string {
  if (limit === undefined) return 'None (plan cap only)'
  if (limit === -1) return 'Unlimited (approved)'
  return `GHS ${limit.toLocaleString('en-US')}`
}

/**
 * Set/clear a user's compliance-approved campaign-goal ceiling (spec §18). The
 * effective goal cap is MIN(plan cap, this); the change is audited server-side
 * with the given reason.
 */
function ComplianceLimitControl({ userId, current }: { userId: string; current?: number }) {
  const [value, setValue] = useState<string>(
    current === undefined ? '' : current === -1 ? 'unlimited' : String(current),
  )
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<number | undefined>(current)

  const save = async () => {
    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      const v = value.trim().toLowerCase()
      let limit: number | null
      if (v === '') limit = null
      else if (v === 'unlimited' || v === '-1') limit = -1
      else {
        const n = Number(v)
        if (!Number.isFinite(n) || n < 0) {
          throw new Error('Enter a non-negative amount, "unlimited", or leave blank to clear')
        }
        limit = n
      }
      await api.put(`/users/${userId}/compliance-limit`, { limit, reason: reason.trim() || undefined })
      setSaved(limit === null ? undefined : limit)
      setMsg('Compliance limit updated.')
      setReason('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }


  return (
    <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <GavelRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Compliance limit
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.85rem', color: 'text.primary', mb: 1.5 }}>
        {describeLimit(saved)}
      </Typography>
      <TextField
        size="small"
        fullWidth
        label='Amount / "unlimited" / blank to clear'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        sx={{ mb: 1 }}
      />
      <TextField
        size="small"
        fullWidth
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        sx={{ mb: 1 }}
      />
      {msg && <Alert severity="success" sx={{ mb: 1, py: 0 }}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 1, py: 0 }}>{err}</Alert>}
      <Button
        variant="outlined"
        fullWidth
        size="small"
        disabled={saving}
        onClick={save}
        sx={{
          color: 'primary.main', borderColor: 'primary.main', textTransform: 'none',
          fontFamily: '"Outfit", sans-serif',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(143,160,200,0.08)' },
        }}
      >
        {saving ? 'Saving…' : 'Save limit'}
      </Button>
    </Box>
  )
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: user, isLoading: loading, error } = useAdminUser(id ?? '')
  const { data: allCampaigns, isLoading: campaignsLoading, error: campaignsError } = useAdminCampaigns()
  const { data: allDonations, isLoading: donationsLoading, error: donationsError } = useAdminDonations()
  const userCampaigns = useMemo(() => allCampaigns.filter(c => c.creatorId === id), [allCampaigns, id])
  const userDonations = useMemo(() => allDonations.filter(d => d.donorId === id), [allDonations, id])
  const campaigns = usePagination(userCampaigns, 12)
  const donations = usePagination(userDonations, 12)

  if (loading) return <Box sx={{ display: 'grid', gap: 3 }}>{[140, 280, 240].map(height => <Skeleton key={height} variant="rounded" height={height} sx={{ borderRadius: SHAPE.card }} />)}</Box>
  if (error) return <Alert severity="error">Could not load this user. Refresh the page to try again.</Alert>
  if (!user) return <ItemNotFound itemType="User" onBack={() => navigate('/users')} backLabel="Back to Users" />

  return (
    <Box sx={{ color: 'text.primary', minWidth: 0 }}>
      <Button component={RouterLink} to="/users" startIcon={<ArrowBackRoundedIcon />} sx={{ mb: 2 }}>All users</Button>
      <PageHeader tone="gold" eyebrow="Community · Member record" title={user.name} lede="Account details, verification, and giving activity in one place." icon={<PeopleRoundedIcon />} />
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.65fr) minmax(300px, 1fr)' }, alignItems: 'start' }}>
        <Box sx={{ ...panel, p: { xs: 2.5, sm: 3.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Avatar src={user.avatarUrl} alt={user.name} sx={{ width: 72, height: 72, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: SHAPE.sm, fontWeight: 800 }}>{user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Account overview</Typography>
              <Typography sx={{ color: 'text.secondary', overflowWrap: 'anywhere', mb: 1 }}>{user.email}</Typography>
              <Chip label={user.role} size="small" />
            </Box>
          </Box>
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, py: 3, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
            {[
              ['Country', user.country || 'Not provided'],
              ['Joined', new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
              ['Verification', verificationLabels[user.verificationLevel] ?? 'Unknown'],
              ['Account ID', user.id],
            ].map(([label, value]) => <Box key={label} sx={{ minWidth: 0 }}><Typography component="dt" variant="caption" color="text.secondary">{label}</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</Typography></Box>)}
          </Box>
          <Box sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography fontWeight={700}>Trust score</Typography><Typography fontWeight={800}>{user.trustScore}<Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}> / 100</Box></Typography></Box>
            <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, user.trustScore))} sx={{ height: 8, borderRadius: SHAPE.bar }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <VerifiedUserIcon sx={{ color: 'primary.main', mt: 0.4 }} />
            <Box><Typography fontWeight={700}>{user.verificationLevel === 0 ? 'Verification needed' : 'Verification on record'}</Typography><Typography variant="body2" color="text.secondary">{user.verificationLevel === 0 ? 'This account needs verification before creating its first campaign.' : 'Review submitted documents and decisions in the verification workspace.'}</Typography><Button component={RouterLink} to="/kyc-review" size="small" sx={{ mt: 1 }}>Open verification review</Button></Box>
          </Box>
        </Box>
        <Box sx={panel}>
          <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}><Typography variant="h6" fontWeight={800}>Campaign eligibility</Typography><Typography variant="body2" color="text.secondary">A compliance ceiling works alongside the member’s subscription plan. The lower limit applies.</Typography></Box>
          <ComplianceLimitControl key={user.id} userId={user.id} current={user.complianceApprovedCampaignLimit} />
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }, mt: 3, alignItems: 'start' }}>
        <Box sx={panel}>
          <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}><Typography variant="h6" fontWeight={800}>Campaigns</Typography><Typography variant="body2" color="text.secondary">Recent campaigns by this member</Typography></Box>
          {campaignsLoading ? <Skeleton height={160} sx={{ mx: 3 }} /> : campaignsError ? <Alert severity="error">Campaign activity could not be loaded.</Alert> : !userCampaigns.length ? <EmptyState variant="noData" title="No campaigns yet" description="Campaigns will appear here when this member creates one." compact /> : <Box>
            {campaigns.page.map(c => <Box key={c.id} component={RouterLink} to={`/campaigns/${c.id}`} sx={{ display: 'block', p: 2.5, borderBottom: 1, borderColor: 'divider', color: 'text.primary', textDecoration: 'none', '&:hover': { bgcolor: 'action.hover' } }}><Typography fontWeight={700}>{c.title}</Typography><Typography variant="body2" color="text.secondary">{c.status.replaceAll('_', ' ')} · GH₵ {c.raisedAmount.toLocaleString()} raised</Typography></Box>)}
            <PaginationBar pagination={campaigns} neumorphic />
          </Box>}
        </Box>
        <Box sx={panel}>
          <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}><Typography variant="h6" fontWeight={800}>Donations</Typography><Typography variant="body2" color="text.secondary">Recent contributions by this member</Typography></Box>
          {donationsLoading ? <Skeleton height={160} sx={{ mx: 3 }} /> : donationsError ? <Alert severity="error">Donation activity could not be loaded.</Alert> : !userDonations.length ? <EmptyState variant="noData" title="No donations yet" description="Contributions will appear here when this member supports a campaign." compact /> : <Box>
            {donations.page.map(d => <Box key={d.id} sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}><Typography fontWeight={700}>{d.currency ?? 'GHS'} {d.amount.toLocaleString()}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{d.campaignTitle ?? d.campaignId}</Typography><Typography variant="caption" color="text.secondary">{new Date(d.createdAt).toLocaleDateString()}</Typography></Box>)}
            <PaginationBar pagination={donations} neumorphic />
          </Box>}
        </Box>
      </Box>
    </Box>
  )
}
