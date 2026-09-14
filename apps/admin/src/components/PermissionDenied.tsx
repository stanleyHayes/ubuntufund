import { Box, Button, Typography } from '@mui/material'
import LockOutlined from '@mui/icons-material/LockOutlined'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { Link as RouterLink } from 'react-router-dom'
import PageHeader from './PageHeader'
import { insetSurface, raisedSurface } from '@/lib/surfaces'

export default function PermissionDenied() {
  return (
    <Box>
      <PageHeader
        eyebrow="Account permissions"
        title="Access denied"
        lede="This area requires a different level of access."
        icon={<LockOutlined />}
      />

      <Box
        component="section"
        aria-labelledby="permission-denied-title"
        sx={{
          ...raisedSurface,
          position: 'relative',
          overflow: 'hidden',
          minHeight: { xs: 'auto', md: 440 },
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(180px, 0.7fr) minmax(0, 1.3fr)' },
          alignItems: 'center',
          gap: { xs: 3, md: 6 },
          px: { xs: 3, sm: 5, lg: 8 },
          py: { xs: 5, md: 7 },
        }}
      >
        <Box aria-hidden="true" sx={{ position: 'absolute', right: -48, bottom: -64, color: 'primary.main', opacity: 0.035, pointerEvents: 'none' }}>
          <LockOutlined sx={{ fontSize: 320 }} />
        </Box>

        <Box aria-hidden="true" sx={{ display: 'grid', placeItems: 'center' }}>
          <Box sx={{ ...insetSurface, width: { xs: 136, md: 192 }, height: { xs: 136, md: 192 }, borderRadius: '50%', display: 'grid', placeItems: 'center', position: 'relative' }}>
            <Box sx={{ ...raisedSurface, width: { xs: 92, md: 128 }, height: { xs: 92, md: 128 }, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'primary.main' }}>
              <LockOutlined sx={{ fontSize: { xs: 44, md: 60 }, strokeWidth: 0.5 }} />
            </Box>
            <Box sx={{ position: 'absolute', right: { xs: 6, md: 12 }, bottom: { xs: 6, md: 12 }, width: 34, height: 34, borderRadius: '50%', bgcolor: 'secondary.main', color: 'secondary.contrastText', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '1rem' }}>!</Box>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', maxWidth: 520, textAlign: { xs: 'center', md: 'left' }, mx: { xs: 'auto', md: 0 } }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.16em', fontWeight: 600 }}>
            Restricted area
          </Typography>
          <Typography id="permission-denied-title" component="h2" sx={{ mt: 1, mb: 2, color: 'text.primary', fontWeight: 700, fontSize: { xs: '1.75rem', md: '2.35rem' }, lineHeight: 1.15, letterSpacing: '-0.035em', textWrap: 'balance' }}>
            You don’t have permission to view this page.
          </Typography>
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.7, maxWidth: 460 }}>
            Your current role doesn’t include access to this area. If you need it for your work, contact a platform administrator to review your permissions.
          </Typography>
          <Button
            component={RouterLink}
            to="/"
            variant="contained"
            startIcon={<ArrowBackRounded />}
            sx={{ mt: 3.5, minHeight: 48, px: 3, width: { xs: '100%', sm: 'auto' }, '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover, &:active': { transform: 'none' } } }}
          >
            Back to dashboard
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
