import { Box, Button, Typography } from '@mui/material'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import { raisedSurface } from '@/lib/surfaces'
export default function RouteErrorPage() {
  const error = useRouteError()
  const missing = isRouteErrorResponse(error) && error.status === 404
  return <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', display: 'grid', placeItems: 'center', p: { xs: 2, sm: 4 } }}>
    <Box sx={{ ...raisedSurface, width: '100%', maxWidth: 720, p: { xs: 2, sm: 4 } }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', textAlign: 'center', letterSpacing: 3 }}>UJIMORA · ADMIN</Typography>
      <EmptyState variant={missing ? 'notFound' : 'error'} title={missing ? 'This page isn’t here' : 'Let’s get you back on track'} description={missing ? 'The page may have moved, or the link may be incomplete.' : 'Something interrupted this page. Try reloading it, or return to your dashboard.'} />
      <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2 }}>
        {!missing && <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => window.location.reload()}>Reload page</Button>}
        <Button href="/" startIcon={<DashboardRoundedIcon />}>Back to dashboard</Button>
      </Box>
    </Box>
  </Box>
}
