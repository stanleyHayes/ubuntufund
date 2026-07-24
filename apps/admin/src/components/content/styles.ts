import type { SxProps, Theme } from '@mui/material'

/** Hairline border used for outlined content surfaces on the dark console. */
export const CONTENT_HAIRLINE = 'rgba(232, 235, 227, 0.10)'

/** Consistent rounded field styling for the CMS editors. */
export const fieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: 'rgba(232,235,227,0.03)',
  },
}

/** Flat, outlined section panel — no shadow, 1px border. */
export const sectionCardSx: SxProps<Theme> = {
  border: `1px solid ${CONTENT_HAIRLINE}`,
  borderRadius: '4px 16px 4px 16px',
  bgcolor: 'background.paper',
  p: { xs: 2.5, md: 3 },
}
