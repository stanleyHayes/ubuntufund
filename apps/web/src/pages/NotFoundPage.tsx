import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'
import { useLocation } from 'react-router-dom'
import { useSeo } from '@/lib/seo'

export function NotFoundPage() {
  const { pathname } = useLocation()
  // A SPA serves 200 OK for a URL that does not exist, so without this the
  // page is a textbook soft 404: indexable, and carrying whatever canonical
  // the previously-visited route left in the head.
  useSeo({
    title: 'Page not found | Ujimora',
    description: 'That page does not exist. Browse live campaigns on Ujimora instead.',
    path: pathname,
    robots: 'noindex, follow',
  })
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ minHeight: { md: '55vh' }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '1fr 1fr' }, alignItems: 'center', gap: { xs: 5, md: 8 } }}>
        <Box aria-hidden="true" sx={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: { xs: 230, md: 380 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-inset)', overflow: 'hidden' }}>
          <Typography sx={{ position: 'absolute', fontSize: { xs: '9rem', md: '13rem' }, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.07em', color: 'text.primary', opacity: 0.055 }}>404</Typography>
          <Box component="svg" viewBox="0 0 320 180" sx={{ position: 'relative', width: '80%', maxWidth: 350, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M22 90h35m206 0h35" stroke="currentColor" strokeWidth="2" strokeDasharray="3 8" opacity="0.3" />
            <rect x="68" y="56" width="68" height="68" rx="8" transform="rotate(-35 102 90)" stroke="#C7A24A" strokeWidth="7" />
            <rect x="186" y="56" width="68" height="68" rx="24" transform="rotate(-35 220 90)" stroke="#A8B5A0" strokeWidth="7" />
            <path d="m151 60 9 12m7 37 9 12m-30-30h16" stroke="currentColor" strokeWidth="3" opacity="0.5" />
          </Box>
        </Box>
        <Box sx={{ maxWidth: 460 }}>
          <Typography variant="overline" color="text.secondary">404 · Page not found</Typography>
          <Typography component="h1" sx={{ fontSize: { xs: '2.2rem', md: '3.25rem' }, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1, mt: 1.5, mb: 2 }}>A missing link.<br />Still connected.</Typography>
          <Typography color="text.secondary" sx={{ lineHeight: 1.8, mb: 3.5 }}>This page may have moved, or the link may be incorrect. There are still plenty of causes to connect with.</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button component={RouterLink} to="/explore" variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />}>Explore campaigns</Button>
            <Button component={RouterLink} to="/" variant="outlined" startIcon={<HomeOutlinedIcon />}>Back to home</Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 4, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>Following a shared link? Check that the full address was copied.</Typography>
        </Box>
      </Box>
    </Container>
  )
}
