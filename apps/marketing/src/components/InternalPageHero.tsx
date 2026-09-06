import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { SHAPE } from '@ubuntu-fund/ui'

interface InternalPageHeroProps {
  eyebrow: string
  title: ReactNode
  description: ReactNode
  icon: ReactNode
  panelLabel: string
  panelTitle: string
  panelBody?: string
  primaryAction?: { label: string; href: string }
  secondaryAction?: { label: string; href: string }
}

export function InternalPageHero({
  eyebrow,
  title,
  description,
  icon,
  panelLabel,
  panelTitle,
  panelBody,
  primaryAction,
  secondaryAction,
}: InternalPageHeroProps) {
  return (
    <Box
      component="section"
      sx={{
        '--neu-surface': '#243126',
        '--neu-raised': 'var(--forest-raised)',
        '--neu-raised-hover': 'var(--forest-raised-hover)',
        '--neu-subtle': 'var(--forest-subtle)',
        '--neu-inset': 'var(--forest-inset)',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#243126',
        color: '#F5F2EA',
        pt: { xs: 9, md: 13 },
        pb: { xs: 8, md: 11 },
      }}
    >
      <Box sx={{ position: 'absolute', width: 540, height: 540, borderRadius: '50%', top: -350, right: -130, border: '1px solid rgba(199,162,74,.14)' }} />
      <Box sx={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', bottom: -270, left: -100, bgcolor: 'rgba(168,181,160,.045)' }} />
      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.18fr) minmax(300px,.62fr)' }, gap: { xs: 6, md: 10 }, alignItems: 'end' }}>
          <Box>
            <Typography variant="overline" sx={{ color: '#DCC07E' }}>{eyebrow}</Typography>
            <Typography component="h1" sx={{ mt: 2, maxWidth: 760, fontSize: { xs: '2.8rem', sm: '3.8rem', md: '4.8rem' }, fontWeight: 900, lineHeight: .98, letterSpacing: '-.043em', textWrap: 'balance' }}>
              {title}
            </Typography>
            <Typography sx={{ mt: 3, maxWidth: 660, color: 'rgba(245,242,234,.7)', fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.7 }}>
              {description}
            </Typography>
            {(primaryAction || secondaryAction) && (
              <Box sx={{ mt: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {primaryAction && <Button variant="contained" color="secondary" href={primaryAction.href} endIcon={<ArrowForwardRoundedIcon />}>{primaryAction.label}</Button>}
                {secondaryAction && <Button href={secondaryAction.href} sx={{ color: '#F5F2EA' }}>{secondaryAction.label}</Button>}
              </Box>
            )}
          </Box>
          <Box sx={{ bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', borderRadius: SHAPE.card, p: { xs: 3, md: 4 } }}>
            <Box sx={{ width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: SHAPE.sm, boxShadow: 'var(--neu-subtle)', color: '#DCC07E', mb: 4, '& svg': { fontSize: 30 } }}>{icon}</Box>
            <Typography variant="overline" sx={{ color: 'rgba(245,242,234,.48)' }}>{panelLabel}</Typography>
            <Typography sx={{ mt: 1.25, fontSize: { xs: '1.45rem', md: '1.7rem' }, fontWeight: 800, lineHeight: 1.2, textWrap: 'balance' }}>{panelTitle}</Typography>
            {panelBody && <Typography sx={{ mt: 2, color: 'rgba(245,242,234,.58)', lineHeight: 1.6 }}>{panelBody}</Typography>}
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
