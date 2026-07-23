import { useState } from 'react'
import { useCampaigns } from '@/hooks/useCampaigns'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Divider from '@mui/material/Divider'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import PeopleIcon from '@mui/icons-material/People'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BlockIcon from '@mui/icons-material/Block'
import DraftsIcon from '@mui/icons-material/Drafts'
import CampaignIcon from '@mui/icons-material/Campaign'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import AnnouncementRoundedIcon from '@mui/icons-material/AnnouncementRounded'
import { Link as RouterLink } from 'react-router-dom'
import { formatCurrency, EmptyState, SHAPE } from '@ubuntu-fund/ui'
import { CampaignStatus, CampaignCategory, CampaignPriority } from '@ubuntu-fund/types'
import type { Campaign } from '@ubuntu-fund/types'

// ─── Constants ─────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
  [CampaignStatus.DRAFT]: { bg: 'rgba(0,0,0,0.06)', color: '#616161', icon: <DraftsIcon sx={{ fontSize: 14 }} />, label: 'Draft' },
  [CampaignStatus.PENDING_REVIEW]: { bg: 'rgba(255,167,38,0.1)', color: '#E65100', icon: <AccessTimeIcon sx={{ fontSize: 14 }} />, label: 'Pending' },
  [CampaignStatus.ACTIVE]: { bg: 'rgba(46,125,50,0.08)', color: '#2E7D32', icon: <TrendingUpIcon sx={{ fontSize: 14 }} />, label: 'Active' },
  [CampaignStatus.FUNDED]: { bg: 'rgba(21,101,192,0.08)', color: '#1565C0', icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, label: 'Funded' },
  [CampaignStatus.EXPIRED]: { bg: 'rgba(0,0,0,0.06)', color: '#9E9E9E', icon: <AccessTimeIcon sx={{ fontSize: 14 }} />, label: 'Expired' },
  [CampaignStatus.BLOCKED]: { bg: 'rgba(239,83,80,0.08)', color: '#E53935', icon: <BlockIcon sx={{ fontSize: 14 }} />, label: 'Blocked' },
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  medical: <LocalHospitalRoundedIcon sx={{ fontSize: 14 }} />,
  education: <SchoolRoundedIcon sx={{ fontSize: 14 }} />,
  emergency: <WarningAmberRoundedIcon sx={{ fontSize: 14 }} />,
  business: <BusinessCenterRoundedIcon sx={{ fontSize: 14 }} />,
  community: <GroupsRoundedIcon sx={{ fontSize: 14 }} />,
  religious: <AccountBalanceRoundedIcon sx={{ fontSize: 14 }} />,
  creative: <PaletteRoundedIcon sx={{ fontSize: 14 }} />,
}

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  [CampaignPriority.CRITICAL]: { color: '#EF5350', label: 'Critical' },
  [CampaignPriority.URGENT]: { color: '#FFA726', label: 'Urgent' },
}

function daysLeft(end: Date) {
  const diff = Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000)
  if (diff <= 0) return 'Ended'
  if (diff === 1) return '1 day'
  return `${diff} days`
}

const TAB_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: CampaignStatus.ACTIVE },
  { label: 'Funded', value: CampaignStatus.FUNDED },
  { label: 'Draft', value: CampaignStatus.DRAFT },
  { label: 'Blocked', value: CampaignStatus.BLOCKED },
]

// ─── Kente Progress Bar ────────────────────────────────────

function KenteProgress({ pct }: { pct: number }) {
  const funded = pct >= 100
  return (
    <Box sx={{ position: 'relative', height: 6, borderRadius: SHAPE.bar, overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.04)' }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          width: `${pct}%`,
          borderRadius: SHAPE.bar,
          background: funded
            ? 'linear-gradient(90deg, #2E7D32, #4CAF50, #66BB6A)'
            : `repeating-linear-gradient(90deg, #2E7D32 0px, #2E7D32 6px, #F9A825 6px, #F9A825 12px, #8D6E63 12px, #8D6E63 18px, #1B5E20 18px, #1B5E20 24px)`,
          backgroundSize: funded ? '100%' : '24px 100%',
          transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </Box>
  )
}

// ─── Campaign Row Card ─────────────────────────────────────

function CampaignRow({
  campaign,
  onShare,
}: {
  campaign: Campaign
  onShare: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const pct = Math.min(Math.round((campaign.raisedAmount / campaign.goalAmount) * 100), 100)
  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG[CampaignStatus.DRAFT]
  const priorityCfg = PRIORITY_CONFIG[campaign.priority]
  const hasImage = campaign.imageUrls.length > 0

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        bgcolor: 'background.paper',
        borderRadius: SHAPE.card,
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: hovered ? 'primary.light' : 'rgba(0,0,0,0.06)',
        transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered
          ? '0 12px 32px rgba(46,125,50,0.08), 0 4px 12px rgba(0,0,0,0.04)'
          : '0 1px 4px rgba(0,0,0,0.02)',
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 28,
          height: 28,
          background: `linear-gradient(135deg, transparent 50%, ${statusCfg.color}12 50%)`,
          pointerEvents: 'none',
        },
      }}
    >
      {/* Thumbnail */}
      <Box
        sx={{
          width: { xs: '100%', sm: 180 },
          minHeight: { xs: 140, sm: 'auto' },
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          bgcolor: hasImage ? 'transparent' : 'rgba(46,125,50,0.06)',
        }}
      >
        {hasImage ? (
          <Box
            component="img"
            src={campaign.imageUrls[0]}
            alt={campaign.title}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              inset: 0,
              transition: 'transform 0.5s ease',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 120 }}>
            <Box sx={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', '& .MuiSvgIcon-root': { fontSize: '2.5rem' } }}>
              {CATEGORY_ICONS[campaign.category] ?? <AnnouncementRoundedIcon />}
            </Box>
          </Box>
        )}

        {/* Status badge on image */}
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            left: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: statusCfg.bg,
            color: statusCfg.color,
            backdropFilter: 'blur(8px)',
            borderRadius: SHAPE.sm,
            px: 1,
            py: 0.25,
            fontSize: '0.65rem',
            fontWeight: 700,
          }}
        >
          {statusCfg.icon}
          {statusCfg.label}
        </Box>

        {/* Priority pulse */}
        {priorityCfg && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: priorityCfg.color,
              boxShadow: `0 0 0 3px ${priorityCfg.color}30`,
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { boxShadow: `0 0 0 3px ${priorityCfg.color}30` },
                '50%': { boxShadow: `0 0 0 6px ${priorityCfg.color}10` },
              },
            }}
          />
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, p: { xs: 2.5, sm: 3 }, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top row: category + time */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{CATEGORY_ICONS[campaign.category] ?? null} {campaign.category.charAt(0).toUpperCase() + campaign.category.slice(1)}</Box>}
            size="small"
            sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600, bgcolor: 'rgba(0,0,0,0.04)' }}
          />
          {priorityCfg && (
            <Chip
              label={priorityCfg.label}
              size="small"
              sx={{ height: 22, fontSize: '0.65rem', fontWeight: 700, bgcolor: `${priorityCfg.color}12`, color: priorityCfg.color }}
            />
          )}
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <AccessTimeIcon sx={{ fontSize: 13 }} />
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {daysLeft(campaign.endDate)}
            </Typography>
          </Box>
        </Box>

        {/* Title */}
        <Typography
          component={RouterLink}
          to={`/campaigns/${campaign.id}`}
          sx={{
            fontWeight: 700,
            fontSize: '1.05rem',
            lineHeight: 1.3,
            mb: 0.5,
            textDecoration: 'none',
            color: hovered ? 'primary.dark' : 'text.primary',
            transition: 'color 0.2s',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {campaign.title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.5,
          }}
        >
          {campaign.description}
        </Typography>

        {/* Progress */}
        <KenteProgress pct={pct} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'primary.dark' }}>
            {formatCurrency(campaign.raisedAmount, campaign.currency)}
            <Typography component="span" sx={{ fontWeight: 400, fontSize: '0.75rem', color: 'text.secondary', ml: 0.5 }}>
              of {formatCurrency(campaign.goalAmount, campaign.currency)}
            </Typography>
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: pct >= 100 ? 'success.main' : 'text.secondary' }}>
            {pct}%
          </Typography>
        </Box>

        {/* Bottom row: stats + actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 1.5, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
            <PeopleIcon sx={{ fontSize: 15 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              0 donors
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="View" arrow>
              <IconButton
                component={RouterLink}
                to={`/campaigns/${campaign.id}`}
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'rgba(46,125,50,0.06)' } }}
              >
                <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit" arrow>
              <IconButton
                component={RouterLink}
                to={`/campaigns/${campaign.id}`}
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'rgba(46,125,50,0.06)' } }}
              >
                <EditRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share link" arrow>
              <IconButton
                size="small"
                onClick={onShare}
                sx={{ color: 'text.secondary', '&:hover': { color: '#F9A825', bgcolor: 'rgba(249,168,37,0.06)' } }}
              >
                <ShareRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// ─── Summary Stat Card ─────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 140,
        p: 2.5,
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
          width: 40,
          height: 40,
          borderRadius: SHAPE.sm,
          bgcolor: `${color}10`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& .MuiSvgIcon-root': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  )
}

// ─── Page ──────────────────────────────────────────────────

export function MyCampaignsPage() {
  const { campaigns, isLoading } = useCampaigns()
  const [tabIndex, setTabIndex] = useState(0)
  const [shareSnack, setShareSnack] = useState(false)

  const activeFilter = TAB_FILTERS[tabIndex].value
  const filtered = activeFilter === 'all'
    ? campaigns
    : campaigns.filter((c) => c.status === activeFilter)

  // Summary stats
  const totalRaised = campaigns.reduce((s, c) => s + c.raisedAmount, 0)
  const activeCampaigns = campaigns.filter((c) => c.status === CampaignStatus.ACTIVE).length
  const totalDonors = 0
  const fundedCampaigns = campaigns.filter((c) => c.status === CampaignStatus.FUNDED).length

  function handleShare(campaignId: string) {
    navigator.clipboard.writeText(`${window.location.origin}/campaigns/${campaignId}`)
    setShareSnack(true)
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Summary stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <StatCard label="Total Raised" value={`$${(totalRaised / 1000).toFixed(0)}k+`} color="#2E7D32" icon={<TrendingUpIcon />} />
        <StatCard label="Active" value={activeCampaigns} color="#F9A825" icon={<CampaignIcon />} />
        <StatCard label="Donors" value={totalDonors} color="#1565C0" icon={<PeopleIcon />} />
        <StatCard label="Funded" value={fundedCampaigns} color="#7B1FA2" icon={<CheckCircleIcon />} />
      </Box>

      {/* Tabs + Create button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          sx={{
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              px: 2,
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: SHAPE.bar,
              background: `repeating-linear-gradient(90deg, #2E7D32 0px, #2E7D32 6px, #F9A825 6px, #F9A825 12px, #8D6E63 12px, #8D6E63 18px)`,
            },
          }}
        >
          {TAB_FILTERS.map((t) => {
            const count = t.value === 'all'
              ? campaigns.length
              : campaigns.filter((c) => c.status === t.value).length
            return (
              <Tab
                key={t.value}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {t.label}
                    <Box
                      sx={{
                        bgcolor: 'rgba(0,0,0,0.06)',
                        borderRadius: SHAPE.sm,
                        px: 0.75,
                        py: 0.1,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        lineHeight: 1.4,
                      }}
                    >
                      {count}
                    </Box>
                  </Box>
                }
              />
            )
          })}
        </Tabs>

        <Button
          component={RouterLink}
          to="/campaigns/new"
          variant="contained"
          color="primary"
          startIcon={<AddRoundedIcon />}
          sx={{
            borderRadius: SHAPE.sm,
            px: 3,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: '0 2px 12px rgba(46,125,50,0.25)',
          }}
        >
          New Campaign
        </Button>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Campaign list */}
      {filtered.length === 0 ? (
        <EmptyState
          variant="empty"
          title="No campaigns here"
          description={activeFilter === 'all' ? 'Start making a difference by creating your first campaign.' : `You don't have any ${activeFilter} campaigns.`}
          action={
            <Button
              component={RouterLink}
              to="/campaigns/new"
              variant="contained"
              color="primary"
              startIcon={<AddRoundedIcon />}
              sx={{ borderRadius: SHAPE.sm, textTransform: 'none', fontWeight: 700, mt: 2 }}
            >
              Create a Campaign
            </Button>
          }
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map((campaign) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              onShare={() => handleShare(campaign.id)}
            />
          ))}
        </Box>
      )}

      <Snackbar open={shareSnack} autoHideDuration={2000} onClose={() => setShareSnack(false)}>
        <Alert onClose={() => setShareSnack(false)} severity="success" variant="filled">
          Campaign link copied!
        </Alert>
      </Snackbar>
    </Container>
  )
}
