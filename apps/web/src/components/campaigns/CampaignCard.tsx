import { useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import Snackbar from '@mui/material/Snackbar'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import { Link as RouterLink } from 'react-router-dom'
import { ProgressBar, SHAPE } from '@ubuntu-fund/ui'
import type { Campaign } from '@ubuntu-fund/types'

interface CampaignCardProps {
  campaign: Campaign
}

const MS_PER_DAY = 86_400_000

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
}

/** Forest-toned cover placeholder with the unity-chain motif (used by Explore). */
export function CoverPlaceholder({ category, height = 150 }: { category: string; height?: number }) {
  return (
    <Box
      sx={{
        height,
        background: 'linear-gradient(150deg, #2E3D2F 0%, #1C261D 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box component="svg" viewBox="0 0 220 60" aria-hidden sx={{ width: 150, opacity: 0.8 }}>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={14 + i * 52}
            y={12}
            width={32}
            height={32}
            rx={i % 2 === 0 ? 4 : 12}
            transform={`rotate(45 ${30 + i * 52} 28)`}
            fill="none"
            stroke={i % 2 === 0 ? '#C7A24A' : '#A8B5A0'}
            strokeWidth={2.5}
            opacity={i % 2 === 0 ? 0.9 : 0.6}
          />
        ))}
      </Box>
      <Typography
        sx={{
          position: 'absolute',
          bottom: 10,
          left: 14,
          fontSize: '0.6rem',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(245, 242, 234, 0.55)',
        }}
      >
        {formatCategory(category)}
      </Typography>
    </Box>
  )
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const [now] = useState(() => Date.now())
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const daysLeft = useMemo(
    () => Math.ceil((new Date(campaign.endDate).getTime() - now) / MS_PER_DAY),
    [campaign.endDate, now]
  )
  const href = `/campaigns/${campaign.id}`
  const pct = campaign.goalAmount > 0 ? Math.min(Math.round((campaign.raisedAmount / campaign.goalAmount) * 100), 100) : 0
  const supporters = campaign.donorCount ?? 0
  const fullUrl = `${window.location.origin}${href}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
    } catch {
      // Clipboard can be unavailable (permissions); fail quietly.
    }
    setMenuAnchor(null)
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: campaign.title, url: fullUrl })
      } catch {
        // User dismissed the share sheet.
      }
    } else {
      await copyLink()
      return
    }
    setMenuAnchor(null)
  }

  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      {/* Kebab sits outside the link area so the card stays a single link */}
      <IconButton
        size="small"
        aria-label={`More actions for ${campaign.title}`}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{ position: 'absolute', top: 14, right: 12, zIndex: 2, color: 'text.secondary' }}
      >
        <MoreHorizRoundedIcon sx={{ fontSize: 20 }} />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { borderRadius: '12px', border: '1px solid #E7E3D8' } } }}
      >
        <MenuItem onClick={copyLink}>
          <ListItemIcon><ContentCopyRoundedIcon sx={{ fontSize: 17 }} /></ListItemIcon>
          Copy link
        </MenuItem>
        <MenuItem onClick={share}>
          <ListItemIcon><IosShareRoundedIcon sx={{ fontSize: 17 }} /></ListItemIcon>
          Share
        </MenuItem>
      </Menu>
      <Snackbar
        open={copied}
        autoHideDuration={2500}
        onClose={() => setCopied(false)}
        message="Link copied to clipboard"
      />

      <CardActionArea
        component={RouterLink}
        to={href}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          p: 2.5,
          '&:hover .card-cta': { color: '#A07E33' },
          '&:hover .card-cta svg': { transform: 'translateX(3px)' },
        }}
      >
        {/* Top row: category + clock */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 4 }}>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              label={formatCategory(campaign.category)}
              size="small"
              sx={{
                bgcolor: 'rgba(168, 181, 160, 0.24)',
                color: '#2E3D2F',
                fontWeight: 600,
                borderRadius: SHAPE.sm,
              }}
            />
            {campaign.priority === 'critical' && <Chip label="Critical" size="small" color="error" />}
            {campaign.priority === 'urgent' && <Chip label="Urgent" size="small" color="warning" />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <CalendarTodayRoundedIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
              {daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}
            </Typography>
          </Box>
        </Box>

        {/* Title + description */}
        <Typography
          component="h3"
          sx={{
            mt: 1.5,
            fontFamily: '"TT Squares", "Inter", sans-serif',
            fontWeight: 700,
            fontSize: '1.1rem',
            lineHeight: 1.3,
            color: 'text.primary',
          }}
        >
          {campaign.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.55 }}>
          {truncate(campaign.description, 110)}
        </Typography>

        {/* Amounts + progress */}
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
              <Typography
                sx={{
                  fontFamily: '"TT Squares", "Inter", sans-serif',
                  fontWeight: 900,
                  fontSize: '1.35rem',
                  color: 'text.primary',
                  lineHeight: 1,
                }}
              >
                GH₵ {campaign.raisedAmount.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                of GH₵ {campaign.goalAmount.toLocaleString()}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: pct >= 100 ? '#A07E33' : 'text.primary' }}>
              {pct}%
            </Typography>
          </Box>
          <ProgressBar
            current={campaign.raisedAmount}
            goal={campaign.goalAmount}
            currency={campaign.currency}
            showAmounts={false}
            showPercentage={false}
          />

          {/* Supporters + CTA */}
          <Box
            sx={{
              mt: 1.75,
              pt: 1.5,
              borderTop: '1px solid #EEEAE0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  bgcolor: 'rgba(168, 181, 160, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2E3D2F',
                }}
              >
                <GroupsRoundedIcon sx={{ fontSize: 15 }} />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                {supporters > 0
                  ? `${supporters.toLocaleString()} supporter${supporters === 1 ? '' : 's'}`
                  : 'Be the first supporter'}
              </Typography>
            </Box>
            <Typography
              className="card-cta"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 700,
                fontSize: '0.85rem',
                color: '#2E3D2F',
                transition: 'color 0.15s ease',
              }}
            >
              View Details
              <ArrowForwardRoundedIcon sx={{ fontSize: 15, transition: 'transform 0.15s ease' }} />
            </Typography>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  )
}
