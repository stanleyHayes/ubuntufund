import { useId, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { SHAPE } from '@ubuntu-fund/ui'

export type CampaignSort = 'most_funded' | 'newest'
const OPTIONS = [
  { value: 'most_funded', title: 'Highest funded %', description: 'Highest percentage of funding goal raised', icon: TrendingUpRoundedIcon },
  { value: 'newest', title: 'Newest first', description: 'Most recently created campaigns', icon: ScheduleRoundedIcon },
] as const

const surface = {
  bgcolor: 'var(--neu-surface)', border: 'var(--neu-border)', borderRadius: SHAPE.card,
  boxShadow: 'var(--neu-subtle)', backdropFilter: 'var(--neu-backdrop)',
  WebkitBackdropFilter: 'var(--neu-backdrop)',
}

export function CampaignSearchBar({ search, onSearch, sort, onSort }: {
  search: string
  onSearch: (value: string) => void
  sort: CampaignSort
  onSort: (value: CampaignSort) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const selected = OPTIONS.find((option) => option.value === sort) ?? OPTIONS[0]
  const SortIcon = selected.icon
  return (
    <Box data-campaign-search sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 250px' }, gap: 1.5, mb: 3 }}>
      <Box sx={{ ...surface, borderRadius: SHAPE.input, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, minWidth: 0,
        '&:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0,
          borderRadius: SHAPE.sm, bgcolor: 'action.hover', color: 'primary.main' }}>
          <SearchRoundedIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="label" htmlFor={`${id}-search`} sx={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', mb: 0.25 }}>Find a campaign</Typography>
          <Box component="input" ref={input} id={`${id}-search`} type="search" value={search} onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by campaign name" autoComplete="off"
            sx={{ width: '100%', minWidth: 0, p: 0, border: 0, outline: 0, bgcolor: 'transparent', color: 'text.primary',
              fontFamily: 'inherit', fontSize: '1rem', lineHeight: 1.5,
              '&::placeholder': { color: 'text.secondary', opacity: 1 }, '&::-webkit-search-cancel-button': { WebkitAppearance: 'none' } }} />
        </Box>
        {search && <Box component="button" type="button" aria-label="Clear search" onClick={() => { onSearch(''); input.current?.focus() }}
          sx={{ display: 'grid', placeItems: 'center', flexShrink: 0, width: 36, height: 36, border: 0, borderRadius: SHAPE.sm,
            bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}><CloseRoundedIcon sx={{ fontSize: 18 }} /></Box>}
      </Box>
      <Box component="button" type="button" id={`${id}-sort`} aria-haspopup="menu" aria-expanded={!!anchor}
        aria-controls={anchor ? `${id}-menu` : undefined} onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ ...surface, display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.5, textAlign: 'left',
          color: 'text.primary', fontFamily: 'inherit', cursor: 'pointer', minHeight: 72,
          '&:hover': { boxShadow: 'var(--neu-raised-hover)' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}>
        <SortIcon sx={{ fontSize: 22, color: 'primary.main' }} />
        <Box component="span" sx={{ flex: 1 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>Sort campaigns</Typography>
          <Typography component="span" sx={{ display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>{selected.title}</Typography>
        </Box>
        <ExpandMoreRoundedIcon sx={{ fontSize: 20, color: 'text.secondary', transform: anchor ? 'rotate(180deg)' : undefined }} />
      </Box>
      <Menu id={`${id}-menu`} anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ list: { 'aria-labelledby': `${id}-sort` }, paper: { sx: { mt: 1, p: 0.5, width: 330, maxWidth: 'calc(100vw - 32px)', borderRadius: SHAPE.card,
          bgcolor: 'background.default', border: 'var(--neu-border)', boxShadow: 'var(--neu-raised)', backdropFilter: 'var(--neu-backdrop)' } } }}>
        {OPTIONS.map(({ value, title, description, icon: Icon }) => (
          <MenuItem key={value} selected={sort === value} onClick={() => { onSort(value); setAnchor(null) }}
            sx={{ gap: 1.25, p: 1.5, borderRadius: SHAPE.sm, whiteSpace: 'normal' }}>
            <Icon sx={{ color: 'primary.main', fontSize: 22 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{title}</Typography>
              <Typography sx={{ fontSize: '0.73rem', color: 'text.secondary', mt: 0.25 }}>{description}</Typography>
            </Box>
            {sort === value && <CheckRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}
