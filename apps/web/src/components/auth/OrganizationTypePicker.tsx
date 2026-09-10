import { useId } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { SHAPE } from '@ubuntu-fund/ui'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import Diversity1RoundedIcon from '@mui/icons-material/Diversity1Rounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { OrganizationType } from '@ubuntu-fund/types'

const OPTIONS = [
  { value: OrganizationType.NGO, title: 'NGO / Non-profit', description: 'Charities and community causes', icon: VolunteerActivismRoundedIcon },
  { value: OrganizationType.HOSPITAL, title: 'Hospital / Health', description: 'Healthcare and patient support', icon: LocalHospitalRoundedIcon },
  { value: OrganizationType.SCHOOL, title: 'School / Education', description: 'Schools and learning initiatives', icon: SchoolRoundedIcon },
  { value: OrganizationType.RELIGIOUS, title: 'Religious body', description: 'Faith groups and congregations', icon: Diversity1RoundedIcon },
  { value: OrganizationType.GOVERNMENT, title: 'Government / Public', description: 'Public services and civic projects', icon: AccountBalanceRoundedIcon },
  { value: OrganizationType.OTHER, title: 'Other', description: 'Businesses and other organizations', icon: WorkspacesRoundedIcon },
] as const

export function OrganizationTypePicker({ value, onChange, error }: {
  value: string
  onChange: (value: OrganizationType) => void
  error?: string
}) {
  const id = useId()
  return (
    <Box component="fieldset" aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} aria-invalid={!!error}
      sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Typography component="legend" sx={{ p: 0, fontSize: '0.95rem', fontWeight: 700, color: 'text.primary' }}>
        Organization type <Box component="span" sx={{ color: 'text.secondary' }}>*</Box>
      </Typography>
      <Typography id={`${id}-hint`} sx={{ mt: 0.5, mb: 1.5, fontSize: '0.8rem', color: 'text.secondary' }}>
        Choose the best fit for the work you do.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
        {OPTIONS.map(({ value: option, title, description, icon: Icon }) => {
          const selected = value === option
          return (
            <Box component="label" key={option} sx={{ position: 'relative', cursor: 'pointer', minWidth: 0 }}>
              <Box component="input" type="radio" name={`${id}-organization-type`} value={option}
                checked={selected} onChange={() => onChange(option)} required
                aria-labelledby={`${id}-${option}-title`} aria-describedby={`${id}-${option}-description`}
                sx={{ position: 'absolute', width: 1, height: 1, opacity: 0,
                  '&:focus-visible + .organization-option': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }} />
              <Box className="organization-option" sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1.25, p: 1.5, height: '100%', boxSizing: 'border-box',
                borderRadius: SHAPE.card, border: '1.5px solid',
                borderColor: selected ? 'primary.main' : error ? 'error.main' : 'divider',
                bgcolor: 'background.paper',
                boxShadow: selected ? 'var(--neu-inset)' : 'var(--neu-raised)',
                backdropFilter: 'var(--neu-backdrop, none)',
                transition: 'background-color 150ms ease, border-color 150ms ease',
                '&:hover': { boxShadow: selected ? 'var(--neu-inset)' : 'var(--neu-raised-hover)' },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}>
                <Box sx={{ display: 'grid', placeItems: 'center', width: 34, height: 34, flexShrink: 0, borderRadius: SHAPE.sm,
                  bgcolor: selected ? 'primary.main' : 'action.hover', color: selected ? 'primary.contrastText' : 'primary.main' }}>
                  <Icon sx={{ fontSize: 20 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography id={`${id}-${option}-title`} sx={{ fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.4, color: 'text.primary' }}>{title}</Typography>
                  <Typography id={`${id}-${option}-description`} sx={{ mt: 0.4, fontSize: '0.73rem', lineHeight: 1.5, color: 'text.secondary' }}>{description}</Typography>
                </Box>
                <Box aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', width: 16, height: 16, mt: 0.25, flexShrink: 0,
                  borderRadius: '50%', border: '1px solid', borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected ? 'primary.main' : 'transparent', color: 'primary.contrastText' }}>
                  {selected && <CheckRoundedIcon sx={{ fontSize: 12 }} />}
                </Box>
              </Box>
            </Box>
          )
        })}
      </Box>
      {error && <Typography id={`${id}-error`} role="alert" sx={{ mt: 1, color: 'error.main', fontSize: '0.75rem' }}>{error}</Typography>}
    </Box>
  )
}
