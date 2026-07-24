import type { ReactNode } from 'react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'

const HAIRLINE = 'rgba(232, 235, 227, 0.10)'

interface EditableRowProps {
  /** Zero-based position, rendered as a 1-based badge. */
  index: number
  /** Total rows, used to disable the move controls at the ends. */
  count: number
  /** Optional label shown next to the position badge. */
  label?: string
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  children: ReactNode
}

/**
 * Outlined, flat row card used across the CMS list editors (stats, FAQ, team).
 * Provides a consistent header with a position badge and move/remove controls;
 * the row's fields are passed as children. No shadow, 1px border — per the
 * outlined-card design system.
 */
export default function EditableRow({
  index,
  count,
  label,
  onMoveUp,
  onMoveDown,
  onRemove,
  children,
}: EditableRowProps) {
  return (
    <Box
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: '4px 16px 4px 16px',
        bgcolor: 'background.paper',
        p: 2.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '3px 10px 3px 10px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(199,162,74,0.14)',
              color: '#C7A24A',
              fontSize: '0.72rem',
              fontWeight: 800,
            }}
          >
            {index + 1}
          </Box>
          {label && (
            <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.secondary' }}>
              {label}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          <Tooltip title="Move up">
            <span>
              <IconButton size="small" onClick={onMoveUp} disabled={index === 0} sx={{ color: 'text.secondary' }}>
                <ArrowUpwardRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Move down">
            <span>
              <IconButton
                size="small"
                onClick={onMoveDown}
                disabled={index === count - 1}
                sx={{ color: 'text.secondary' }}
              >
                <ArrowDownwardRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Remove">
            <IconButton
              size="small"
              onClick={onRemove}
              sx={{ color: 'text.secondary', '&:hover': { color: '#C06B58' } }}
            >
              <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {children}
    </Box>
  )
}

/** Immutably move an array item from one index to an adjacent slot. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
