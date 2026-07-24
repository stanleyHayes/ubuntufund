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
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
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
const MEDIA_HEIGHT = 186

// Sage & Neutrals tokens used directly in this composition.
const FOREST = '#2E3D2F'
const FOREST_DARK = '#1C261D'
const SAGE = '#A8B5A0'
const PARCHMENT = '#F2EFEA'
const INK = '#1A2E22'
const INK_SECONDARY = '#4A5A50'
const GOLD = '#C7A24A'
const GOLD_DARK = '#A07E33'
const SUCCESS = '#2F6B46'
const CLAY = '#A5432F'
const WARN = '#B98A2E'

/** Ghanaian cedi, always rendered "GH₵ 12,500" (symbol + hair space + grouped amount). */
function cedis(amount: number): string {
  return `GH₵ ${new Intl.NumberFormat('en-GH').format(Math.round(amount))}`
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
}

/** A rotated-square bullet — the platform's signature dot motif. */
function DiamondDot({ color = GOLD, size = 7 }: { color?: string; size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{ width: size, height: size, bgcolor: color, transform: 'rotate(45deg)', flexShrink: 0 }}
    />
  )
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

  // Postmark tone shifts with priority / recency.
  const stampTone =
    campaign.priority === 'critical' ? CLAY : campaign.priority === 'urgent' ? WARN : FOREST_DARK
  const daysLabel =
    daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Ended'

  const capacityColor = funded ? SUCCESS : FOREST

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
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Kebab lives outside the link area so the card stays a single link target. */}
      <IconButton
        size="small"
        aria-label={`More actions for ${campaign.title}`}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 3,
          color: FOREST,
          bgcolor: 'rgba(242, 239, 234, 0.88)',
          backdropFilter: 'none',
          '&:hover': { bgcolor: PARCHMENT },
        }}
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
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          '&:hover .cta-arrow': { transform: 'translateX(4px)' },
          '&:hover .cta-label': { color: GOLD_DARK },
          '@media (prefers-reduced-motion: reduce)': {
            '&:hover .cta-arrow': { transform: 'none' },
          },
        }}
      >
        {/* ── Media band: image backdrop under a forest scrim, with overlaid dispatch marks ── */}
        <Box sx={{ position: 'relative', height: MEDIA_HEIGHT, overflow: 'hidden' }}>
          {/* Forest placeholder is always the base layer, so a missing/broken image still reads on-brand. */}
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
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          )}
          {/* Scrim: slight top darken for the eyebrow, heavy bottom for the title. */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(180deg, rgba(28,38,29,0.30) 0%, rgba(28,38,29,0) 32%, rgba(28,38,29,0.55) 66%, rgba(28,38,29,0.92) 100%)`,
            }}
          />

          {/* Eyebrow category label, top-left */}
          <Typography
            sx={{
              position: 'absolute',
              top: 14,
              left: 16,
              fontSize: '0.66rem',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: GOLD,
              textShadow: '0 1px 8px rgba(28,38,29,0.6)',
            }}
          >
            {formatCategory(campaign.category)}
          </Typography>

          {/* Postmark: days-left stamp, bottom-right, tone by priority */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 14,
              right: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.375,
              bgcolor: stampTone,
              color: '#F5F2EA',
              borderRadius: SHAPE.sm,
              border: `1px solid ${daysLeft <= 0 ? 'rgba(245,242,234,0.35)' : GOLD}`,
            }}
          >
            <CalendarTodayRoundedIcon sx={{ fontSize: 12 }} />
            <Typography
              component="span"
              sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}
            >
              {daysLabel}
            </Typography>
          </Box>

          {/* Title overlaid on the scrim, clamped to two lines */}
          <Typography
            component="h3"
            sx={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 44,
              fontWeight: 800,
              fontSize: '1.16rem',
              lineHeight: 1.24,
              color: '#F5F2EA',
              textShadow: '0 1px 10px rgba(28,38,29,0.7)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {campaign.title}
          </Typography>
        </Box>

        {/* ── Stub: torn-ticket seam, then the ledger ── */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            p: 2.25,
            bgcolor: 'background.paper',
            borderTop: `1px dashed #C9C3B4`,
          }}
        >
          {/* One-line dispatch summary keeps the description present without a wall of text */}
          <Typography
            variant="body2"
            sx={{
              color: INK_SECONDARY,
              lineHeight: 1.5,
              mb: 1.75,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.6em',
            }}
          >
            {campaign.description}
          </Typography>

          {/* Funding ledger line */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="span"
                sx={{ fontWeight: 900, fontSize: '1.42rem', lineHeight: 1, color: INK, display: 'block' }}
              >
                {cedis(campaign.raisedAmount)}
              </Typography>
              <Typography
                component="span"
                sx={{ fontSize: '0.8rem', color: INK_SECONDARY, display: 'block', mt: 0.375 }}
              >
                of {cedis(campaign.goalAmount)}
              </Typography>
            </Box>
            <Typography
              component="span"
              sx={{
                fontWeight: 800,
                fontSize: '1.05rem',
                lineHeight: 1,
                color: funded ? SUCCESS : GOLD_DARK,
                whiteSpace: 'nowrap',
              }}
            >
              {pct}%
            </Typography>
          </Box>

          {/* Signature capacity rail: forest fill, tick guides, gold diamond at the funding frontier */}
          <Box
            role="progressbar"
            aria-label={`${pct}% funded`}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            sx={{ position: 'relative', mt: 1.75, mb: 0.25, height: 14 }}
          >
            {/* Track */}
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                left: 0,
                right: 0,
                height: 6,
                bgcolor: 'rgba(46, 61, 47, 0.12)',
                borderRadius: SHAPE.bar,
                overflow: 'hidden',
              }}
            >
              {/* Fill */}
              <Box
                sx={{
                  height: '100%',
                  width: '100%',
                  bgcolor: capacityColor,
                  transformOrigin: 'left center',
                  transform: `scaleX(${pct / 100})`,
                  transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                }}
              />
            </Box>
            {/* Quartile tick guides */}
            {[25, 50, 75].map((t) => (
              <Box
                key={t}
                aria-hidden
                sx={{
                  position: 'absolute',
                  top: 3,
                  left: `${t}%`,
                  width: '1px',
                  height: 8,
                  bgcolor: 'rgba(46, 61, 47, 0.22)',
                }}
              />
            ))}
            {/* Funding-frontier marker: gold rotated square */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                top: 3,
                left: `${pct}%`,
                width: 9,
                height: 9,
                bgcolor: GOLD,
                border: `1.5px solid ${GOLD_DARK}`,
                transform: 'translateX(-50%) rotate(45deg)',
              }}
            />
          </Box>

          {/* Footer: supporters ledger + CTA */}
          <Box
            sx={{
              mt: 'auto',
              pt: 1.75,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, minWidth: 0 }}>
              <DiamondDot color={supporters > 0 ? GOLD : SAGE} />
              <GroupsRoundedIcon sx={{ fontSize: 16, color: INK_SECONDARY }} />
              <Typography
                component="span"
                sx={{ fontSize: '0.8rem', fontWeight: 600, color: INK_SECONDARY, whiteSpace: 'nowrap' }}
              >
                {supporters > 0
                  ? `${supporters.toLocaleString()} supporter${supporters === 1 ? '' : 's'}`
                  : 'Be the first supporter'}
              </Typography>
            </Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              <Typography
                component="span"
                className="cta-label"
                sx={{ fontSize: '0.82rem', fontWeight: 700, color: FOREST, transition: 'color 150ms ease' }}
              >
                View campaign
              </Typography>
              <ArrowForwardRoundedIcon
                className="cta-arrow"
                sx={{ fontSize: 16, color: GOLD_DARK, transition: 'transform 150ms ease' }}
              />
            </Box>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  )
}
