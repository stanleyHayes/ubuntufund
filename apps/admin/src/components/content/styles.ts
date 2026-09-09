import type { SxProps, Theme } from '@mui/material'

/** Consistent rounded field styling for the CMS editors. */
export const fieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: 'rgba(232,235,227,0.03)',
  },
}

/** Raised editor panel using the admin console's matched dark-green material. */
export const sectionCardSx: SxProps<Theme> = {
  borderRadius: '4px 16px 4px 16px',
  bgcolor: 'background.paper',
  boxShadow: 'var(--neu-raised)',
  p: { xs: 2.5, md: 3 },
}
