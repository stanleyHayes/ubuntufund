import { useEntrance } from '@/components/motion/useEntrance'
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
import { SHAPE, sizedImageUrl } from '@ubuntu-fund/ui'
import type { Campaign } from '@ubuntu-fund/types'

interface CampaignCardProps {
  campaign: Campaign
}

const MS_PER_DAY = 86_400_000
const MEDIA_HEIGHT = 190

// Sage & Neutrals tokens.
const FOREST = '#2E3D2F'
const FOREST_DARK = '#1C261D'
const SAGE = '#A8B5A0'
const INK = 'text.primary'
const INK_SECONDARY = 'text.secondary'
const GOLD = '#C7A24A'
const CLAY = '#A5432F'
const WARN = '#B98A2E'

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
  const entrance = useEntrance<HTMLDivElement>()
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
  // Cards are ~400px at their widest; the stored original is whatever the
  // organiser uploaded, often a multi-megabyte phone photo. Sized at delivery.
  const cover = sizedImageUrl(campaign.imageUrls?.[0], { width: 400 })
  const fullUrl = `${window.location.origin}${href}`

  const daysLabel = daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Ended'
  const urgent = daysLeft > 0 && daysLeft <= 7 && !funded
  const priorityTone =
    campaign.priority === 'critical' ? CLAY : campaign.priority === 'urgent' ? WARN : null
  const fillColor = funded ? SAGE : GOLD

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
      ref={entrance}
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '24px !important',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 'var(--neu-raised-hover) !important' },
        '&:hover .cta-arrow': { transform: 'translateX(3px)' },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' }, '&:hover .cta-arrow': { transform: 'none' } },
      }}
    >
      {/* Kebab lives outside the link area so the card stays a single link target. */}
      <IconButton
        size="small"
        aria-label={`More actions for ${campaign.title}`}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 3,
          width: 36,
          height: 36,
          color: 'text.primary',
          bgcolor: 'var(--neu-surface)',
        }}
      >
        <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { borderRadius: '12px', boxShadow: 'var(--neu-raised)' } } }}
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

          {/* Priority flag (only when critical/urgent) — a small colored tab, bottom-left */}
          {priorityTone && (
            <Box
              sx={{
                position: 'absolute',
                top: 14,
                left: 14,
                px: 1.1,
                py: 0.4,
                bgcolor: priorityTone,
                borderRadius: '6px',
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
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.5 }}>
          <Typography sx={{ color: INK_SECONDARY, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>
            {formatCategory(campaign.category)}
          </Typography>
          <Typography
            component="h3"
            sx={{
              fontWeight: 800,
              fontSize: '1.25rem',
              lineHeight: 1.3,
              color: INK,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.75em',
              mb: 2,
            }}
          >
            {campaign.title}
          </Typography>

          <Box sx={{ bgcolor: FOREST_DARK, color: '#F2EFEA', p: 2, borderRadius: '16px', mt: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums' }}>
                {cedis(campaign.raisedAmount)}
                <Box component="span" sx={{ fontSize: '0.7rem', fontWeight: 400, letterSpacing: 0, color: '#C5CEBF', ml: 0.7 }}>raised</Box>
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: GOLD }}>{funded ? 'Funded' : `${pct}%`}</Typography>
            </Box>
            <Box role="progressbar" aria-label={`${pct}% funded`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
              sx={{ height: 5, borderRadius: SHAPE.bar, bgcolor: 'rgba(168,181,160,0.22)', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: '100%', bgcolor: fillColor, transformOrigin: 'left', transform: `scaleX(${pct / 100})` }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 1.2 }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#C5CEBF' }}>Goal {cedis(campaign.goalAmount)}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#C5CEBF' }}>{funded ? 'Goal reached' : `${cedis(Math.max(0, campaign.goalAmount - campaign.raisedAmount))} to go`}</Typography>
            </Box>
          </Box>

          {/* Meta footer: supporters + days-left, then the hover CTA arrow */}
          <Box
            sx={{
              mt: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, color: INK_SECONDARY }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <GroupsRoundedIcon sx={{ fontSize: 16 }} />
                <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {supporters > 0 ? `${supporters.toLocaleString()} supporter${supporters === 1 ? '' : 's'}` : 'Be the first'}
                </Typography>
              </Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: urgent ? 'error.main' : INK_SECONDARY }}>
                <ScheduleRoundedIcon sx={{ fontSize: 16 }} />
                <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {daysLabel}
                </Typography>
              </Box>
            </Box>

          </Box>
          <Box sx={{ mt: 2.25, pt: 1.75, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>View campaign</Typography>
            <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: 'rgba(199,162,74,0.16)', display: 'grid', placeItems: 'center' }}>
              <ArrowForwardRoundedIcon className="cta-arrow" sx={{ fontSize: 17, color: INK, transition: 'transform 150ms ease' }} />
            </Box>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  )
}
