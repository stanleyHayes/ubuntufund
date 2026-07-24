import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Box, Typography, Button, IconButton } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { HAIRLINE, ON_FILL } from '@/lib/tones'

export interface TourStep {
  /** CSS selector of the element to spotlight; omit for a centered card. */
  selector?: string
  title: string
  body: string
  side?: 'right' | 'bottom' | 'top' | 'left'
}

const PAD = 8
const CARD_W = 340
const CARD_MARGIN = 12

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

function measure(selector?: string): TargetRect | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  el.scrollIntoView({ block: 'nearest' })
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function cardPosition(rect: TargetRect | null, side: TourStep['side']): React.CSSProperties {
  if (!rect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  let top = rect.top
  let left = rect.left

  switch (side ?? 'bottom') {
    case 'right':
      left = rect.left + rect.width + PAD + CARD_MARGIN
      break
    case 'left':
      left = rect.left - PAD - CARD_MARGIN - CARD_W
      break
    case 'top':
      top = rect.top - PAD - CARD_MARGIN - 190
      break
    default:
      top = rect.top + rect.height + PAD + CARD_MARGIN
  }

  left = Math.max(CARD_MARGIN, Math.min(left, vw - CARD_W - CARD_MARGIN))
  if (top + 220 > vh) top = Math.max(CARD_MARGIN, rect.top - PAD - CARD_MARGIN - 190)
  top = Math.max(CARD_MARGIN, top)
  return { top, left }
}

const dimSx = {
  position: 'fixed' as const,
  bgcolor: 'rgba(0, 0, 0, 0.55)',
}

export default function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<TargetRect | null>(null)
  const step = steps[index]

  const remeasure = useCallback(() => {
    requestAnimationFrame(() => setRect(measure(step?.selector)))
  }, [step?.selector])

  useLayoutEffect(() => {
    remeasure()
    window.addEventListener('resize', remeasure)
    return () => window.removeEventListener('resize', remeasure)
  }, [remeasure])

  const next = useCallback(() => {
    if (index >= steps.length - 1) onDone()
    else setIndex((i) => i + 1)
  }, [index, steps.length, onDone])

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDone()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone, next, back])

  if (!step) return null
  const last = index === steps.length - 1

  const spot = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null

  return (
    <Box role="dialog" aria-modal="true" aria-label="Product tour" sx={{ position: 'fixed', inset: 0, zIndex: 2100 }}>
      {/* Dim panes forming the spotlight cutout (or one full-screen pane) */}
      {spot ? (
        <>
          <Box sx={{ ...dimSx, top: 0, left: 0, right: 0, height: Math.max(0, spot.top) }} />
          <Box sx={{ ...dimSx, top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} />
          <Box sx={{ ...dimSx, top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height }} />
          <Box sx={{ ...dimSx, top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }} />
          <Box
            sx={{
              position: 'fixed',
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              borderRadius: '12px',
              border: '2px solid #C7A24A',
              boxShadow: '0 0 0 4px rgba(199, 162, 74, 0.25)',
              pointerEvents: 'none',
            }}
          />
        </>
      ) : (
        <Box sx={{ ...dimSx, inset: 0 }} />
      )}

      {/* Card */}
      <Box
        sx={{
          position: 'fixed',
          width: CARD_W,
          maxWidth: 'calc(100vw - 24px)',
          borderRadius: '16px',
          border: `1px solid ${HAIRLINE}`,
          bgcolor: 'background.paper',
          boxShadow: '0 18px 50px rgba(0, 0, 0, 0.5)',
          p: 2.5,
          ...cardPosition(rect, step.side),
        }}
      >
        <IconButton
          size="small"
          aria-label="End tour"
          onClick={onDone}
          sx={{ position: 'absolute', top: 8, right: 8, color: 'text.secondary' }}
        >
          <CloseRoundedIcon sx={{ fontSize: 17 }} />
        </IconButton>

        <Typography
          sx={{
            fontSize: '0.62rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: '#C7A24A',
          }}
        >
          Tour · {index + 1} of {steps.length}
        </Typography>
        <Typography sx={{ mt: 0.75, fontSize: '1.05rem', fontWeight: 700, color: 'text.primary' }}>
          {step.title}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', lineHeight: 1.55 }}>
          {step.body}
        </Typography>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button onClick={onDone} size="small" sx={{ color: 'text.secondary', fontWeight: 600, px: 0.5 }}>
            Skip tour
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {index > 0 && (
              <Button
                size="small"
                variant="outlined"
                onClick={back}
                startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 15 }} />}
                sx={{ borderRadius: '999px', borderColor: HAIRLINE, color: 'text.primary' }}
              >
                Back
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={next}
              endIcon={last ? undefined : <ArrowForwardRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{
                borderRadius: '999px',
                bgcolor: '#8FAE96',
                color: ON_FILL,
                fontWeight: 700,
                '&:hover': { bgcolor: '#B5C9BA' },
              }}
            >
              {last ? 'Done' : 'Next'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
