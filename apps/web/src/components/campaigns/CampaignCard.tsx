import { useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import Snackbar from '@mui/material/Snackbar'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import { Link as RouterLink } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'
import type { Campaign } from '@ubuntu-fund/types'

interface CampaignCardProps {
  campaign: Campaign
}

const MS_PER_DAY = 86_400_000
const MEDIA_HEIGHT = 170

// Sage & Neutrals tokens.
const FOREST = '#2E3D2F'
const FOREST_DARK = '#1C261D'
const SAGE = '#A8B5A0'
const INK = '#1A2E22'
const INK_SECONDARY = '#4A5A50'
const GOLD = '#C7A24A'
const GOLD_DARK = '#A07E33'
const SUCCESS = '#2F6B46'
const CLAY = '#A5432F'
const WARN = '#B98A2E'
const HAIRLINE = '#E7E3D8'

/** Ghanaian cedi, always rendered "GH₵ 12,500". */
function cedis(amount: number): string {
  return `GH₵ ${new Intl.NumberFormat('en-GH').format(Math.round(amount))}`
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
}

/** Forest-toned cover placeholder with the unity-chain motif (also used by Explore). */
export function CoverPlaceholder({
  category,
  height = 150,
  showLabel = true,
}: {
  category: string
  height?: number
  showLabel?: boolean
}) {
  return (
    <Box
      sx={{
        height,
        width: '100%',
        background: `linear-gradient(150deg, ${FOREST} 0%, ${FOREST_DARK} 100%)`,
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
            stroke={i % 2 === 0 ? GOLD : SAGE}
            strokeWidth={2.5}
            opacity={i % 2 === 0 ? 0.9 : 0.6}
          />
        ))}
      </Box>
      {showLabel && (
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
      )}
    </Box>
  )
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const [now] = useState(() => Date.now())
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const [imgBroken, setImgBroken] = useState(false)

  const daysLeft = useMemo(
    () => Math.ceil((new Date(campaign.endDate).getTime() - now) / MS_PER_DAY),
    [campaign.endDate, now]
  )
  const href = `/campaigns/${campaign.id}`
  const pct =
    campaign.goalAmount > 0
      ? Math.min(Math.round((campaign.raisedAmount / campaign.goalAmount) * 100), 100)
      : 0
  const funded = pct >= 100
  const supporters = campaign.donorCount ?? 0
  const cover = campaign.imageUrls?.[0]
  const fullUrl = `${window.location.origin}${href}`

  const daysLabel = daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Ended'
  const urgent = daysLeft > 0 && daysLeft <= 7 && !funded
  const priorityTone =
    campaign.priority === 'critical' ? CLAY : campaign.priority === 'urgent' ? WARN : null
  const fillColor = funded ? SUCCESS : FOREST

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
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 160ms ease',
        '&:hover': { borderColor: SAGE },
        '&:hover .cta-arrow': { transform: 'translateX(3px)' },
        '@media (prefers-reduced-motion: reduce)': { '&:hover .cta-arrow': { transform: 'none' } },
      }}
    >
      {/* Kebab lives outside the link area so the card stays a single link target. */}
      <IconButton
        size="small"
        aria-label={`More actions for ${campaign.title}`}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 3,
          width: 30,
          height: 30,
          color: FOREST,
          bgcolor: 'rgba(245, 242, 234, 0.92)',
          '&:hover': { bgcolor: '#F5F2EA' },
        }}
      >
        <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { borderRadius: '12px', border: `1px solid ${HAIRLINE}` } } }}
      >
        <MenuItem onClick={copyLink}>
          <ListItemIcon>
            <ContentCopyRoundedIcon sx={{ fontSize: 17 }} />
          </ListItemIcon>
          Copy link
        </MenuItem>
        <MenuItem onClick={share}>
          <ListItemIcon>
            <IosShareRoundedIcon sx={{ fontSize: 17 }} />
          </ListItemIcon>
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
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* ── Clean cover: image (or forest placeholder), category chip, optional priority flag ── */}
        <Box sx={{ position: 'relative', height: MEDIA_HEIGHT, overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', inset: 0 }}>
            <CoverPlaceholder category={campaign.category} height={MEDIA_HEIGHT} showLabel={false} />
          </Box>
          {cover && !imgBroken && (
            <Box
              component="img"
              src={cover}
              alt=""
              loading="lazy"
              onError={() => setImgBroken(true)}
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}

          {/* Category chip, top-left */}
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              display: 'inline-flex',
              alignItems: 'center',
              px: 1.1,
              py: 0.4,
              bgcolor: 'rgba(245, 242, 234, 0.94)',
              borderRadius: '999px',
            }}
          >
            <Typography
              sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: FOREST }}
            >
              {formatCategory(campaign.category)}
            </Typography>
          </Box>

          {/* Priority flag (only when critical/urgent) — a small colored tab, bottom-left */}
          {priorityTone && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                px: 1.1,
                py: 0.4,
                bgcolor: priorityTone,
                borderTopRightRadius: SHAPE.sm,
              }}
            >
              <Typography
                sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#F5F2EA' }}
              >
                {campaign.priority === 'critical' ? 'Critical' : 'Urgent'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* ── Body ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.25 }}>
          <Typography
            component="h3"
            sx={{
              fontWeight: 800,
              fontSize: '1.06rem',
              lineHeight: 1.3,
              color: INK,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.75em',
              mb: 1.5,
            }}
          >
            {campaign.title}
          </Typography>

          {/* Progress bar */}
          <Box
            role="progressbar"
            aria-label={`${pct}% funded`}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            sx={{ height: 7, borderRadius: SHAPE.bar, bgcolor: 'rgba(168, 181, 160, 0.30)', overflow: 'hidden' }}
          >
            <Box
              sx={{
                height: '100%',
                width: '100%',
                bgcolor: fillColor,
                transformOrigin: 'left center',
                transform: `scaleX(${pct / 100})`,
                transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            />
          </Box>

          {/* Amounts */}
          <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="span" sx={{ fontWeight: 800, fontSize: '1.05rem', color: INK }}>
                {cedis(campaign.raisedAmount)}
              </Typography>
              <Typography component="span" sx={{ fontSize: '0.8rem', color: INK_SECONDARY, ml: 0.5 }}>
                of {cedis(campaign.goalAmount)}
              </Typography>
            </Box>
            <Typography
              component="span"
              sx={{ fontWeight: 800, fontSize: '0.92rem', color: funded ? SUCCESS : GOLD_DARK, whiteSpace: 'nowrap' }}
            >
              {funded ? 'Funded' : `${pct}%`}
            </Typography>
          </Box>

          {/* Meta footer: supporters + days-left, then the hover CTA arrow */}
          <Box
            sx={{
              mt: 'auto',
              pt: 1.75,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              borderTop: `1px solid ${HAIRLINE}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, color: INK_SECONDARY }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <GroupsRoundedIcon sx={{ fontSize: 16 }} />
                <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {supporters > 0 ? supporters.toLocaleString() : 'Be first'}
                </Typography>
              </Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: urgent ? CLAY : INK_SECONDARY }}>
                <ScheduleRoundedIcon sx={{ fontSize: 16 }} />
                <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {daysLabel}
                </Typography>
              </Box>
            </Box>
            <ArrowForwardRoundedIcon
              className="cta-arrow"
              sx={{ fontSize: 18, color: GOLD_DARK, transition: 'transform 150ms ease', flexShrink: 0 }}
            />
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  )
}
