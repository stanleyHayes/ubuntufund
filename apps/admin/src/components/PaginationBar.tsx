import { Box, Typography, IconButton, TextField, MenuItem } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FirstPageIcon from '@mui/icons-material/FirstPage'
import LastPageIcon from '@mui/icons-material/LastPage'
import type { PaginationResult } from '@/hooks/usePagination'

const B = 'rgba(255,255,255,0.06)'

const PAGE_SIZE_OPTIONS = [12, 24, 48]

interface PaginationBarProps {
  pagination: PaginationResult<unknown>
  accentColor?: string
}

export default function PaginationBar({ pagination, accentColor = '#5E8F72' }: PaginationBarProps) {
  const { currentPage, totalPages, rangeLabel, hasNext, hasPrev, goToPage, nextPage, prevPage, pageSize, setPageSize } = pagination

  if (pagination.totalItems === 0) return null

  // Generate page buttons — show at most 5 around current
  const pages: (number | 'ellipsis')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('ellipsis')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('ellipsis')
    pages.push(totalPages)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        px: 3,
        py: 1.5,
        borderTop: `1px solid ${B}`,
        bgcolor: 'rgba(255,255,255,0.01)',
      }}
    >
      {/* Left: range label + page size */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: 'text.secondary',
            fontFamily: '"Outfit", monospace',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {rangeLabel}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
            per page
          </Typography>
          <TextField
            select
            size="small"
            variant="standard"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            sx={{
              width: 52,
              '& .MuiInput-root': {
                color: 'text.primary',
                fontSize: '0.75rem',
                fontFamily: '"Outfit", monospace',
                '&::before': { borderColor: B },
                '&::after': { borderColor: accentColor },
              },
              '& .MuiSelect-select': { py: 0.25 },
            }}
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      {/* Right: page navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {/* First */}
        <IconButton
          size="small"
          onClick={() => goToPage(1)}
          disabled={!hasPrev}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: accentColor, bgcolor: `${accentColor}12` },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.1)' },
          }}
        >
          <FirstPageIcon sx={{ fontSize: 18 }} />
        </IconButton>

        {/* Prev */}
        <IconButton
          size="small"
          onClick={prevPage}
          disabled={!hasPrev}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: accentColor, bgcolor: `${accentColor}12` },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.1)' },
          }}
        >
          <ChevronLeftIcon sx={{ fontSize: 18 }} />
        </IconButton>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <Typography
              key={`e-${i}`}
              sx={{ fontSize: '0.72rem', color: 'text.secondary', px: 0.5, userSelect: 'none' }}
            >
              ...
            </Typography>
          ) : (
            <Box
              key={p}
              onClick={() => goToPage(p)}
              sx={{
                minWidth: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontFamily: '"Outfit", monospace',
                fontWeight: p === currentPage ? 700 : 400,
                color: p === currentPage ? '#fff' : 'text.secondary',
                bgcolor: p === currentPage ? accentColor : 'transparent',
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                userSelect: 'none',
                '&:hover': p !== currentPage
                  ? { bgcolor: `${accentColor}15`, color: accentColor }
                  : undefined,
              }}
            >
              {p}
            </Box>
          ),
        )}

        {/* Next */}
        <IconButton
          size="small"
          onClick={nextPage}
          disabled={!hasNext}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: accentColor, bgcolor: `${accentColor}12` },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.1)' },
          }}
        >
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </IconButton>

        {/* Last */}
        <IconButton
          size="small"
          onClick={() => goToPage(totalPages)}
          disabled={!hasNext}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: accentColor, bgcolor: `${accentColor}12` },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.1)' },
          }}
        >
          <LastPageIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  )
}
