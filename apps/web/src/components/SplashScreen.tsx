import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { BrandLogo, SHAPE } from '@ubuntu-fund/ui'

/** Route-loading fallback: visible immediately, with no artificial delay. */
export function SplashScreen() {
  return (
    <Box role="status" aria-live="polite" aria-label="Loading Ujimora" sx={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'grid', placeItems: 'center', bgcolor: 'background.default', color: 'text.primary', p: 3 }}>
      <Box sx={{ textAlign: 'center', width: '100%', maxWidth: 320 }}>
        <Box aria-hidden="true" sx={{ width: 112, height: 112, mx: 'auto', mb: 4, display: 'grid', placeItems: 'center', borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)' }}>
          <BrandLogo size={52} withWordmark={false} />
        </Box>
        <Typography sx={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em' }}>Ujimora</Typography>
        <Typography sx={{ mt: 0.75, color: 'text.secondary', fontSize: '0.9rem' }}>One chain. Many hands.</Typography>
        <Box aria-hidden="true" sx={{ width: 128, height: 4, mt: 4, mx: 'auto', overflow: 'hidden', borderRadius: 4, bgcolor: 'action.hover', boxShadow: 'var(--neu-inset)', '&::after': { content: '""', display: 'block', height: '100%', width: '45%', borderRadius: 'inherit', bgcolor: 'secondary.main', animation: 'ujimora-loading 1.6s ease-in-out infinite' }, '@keyframes ujimora-loading': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(325%)' } }, '@media (prefers-reduced-motion: reduce)': { '&::after': { animation: 'none', width: '100%' } } }} />
        <Typography aria-hidden="true" sx={{ mt: 1.75, fontSize: '0.75rem', color: 'text.secondary' }}>Loading your next page…</Typography>
      </Box>
    </Box>
  )
}
