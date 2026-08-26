import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { SHAPE } from '@ubuntu-fund/ui'
import { InternalPageHero } from './InternalPageHero'

interface LegalSection {
  title: string
  content: string
}

interface LegalPageLayoutProps {
  eyebrow: string
  title: string
  description: string
  icon: ReactNode
  panelLabel: string
  panelTitle: string
  panelBody: string
  introduction: string
  sections: LegalSection[]
  contact: ReactNode
}

export function LegalPageLayout({
  eyebrow,
  title,
  description,
  icon,
  panelLabel,
  panelTitle,
  panelBody,
  introduction,
  sections,
  contact,
}: LegalPageLayoutProps) {
  return (
    <Box component="main" sx={{ flex: 1, pb: { xs: 8, md: 12 }, bgcolor: 'background.default' }}>
      <InternalPageHero
        eyebrow={eyebrow}
        title={title}
        description={description}
        icon={icon}
        panelLabel={panelLabel}
        panelTitle={panelTitle}
        panelBody={panelBody}
      />

      <Container maxWidth="lg" sx={{ mt: { xs: 5, md: 8 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '240px minmax(0, 1fr)' }, gap: { xs: 4, md: 6 }, alignItems: 'start' }}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 92 }, p: 2.5, borderRadius: SHAPE.card, bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-subtle)' }}>
            <Chip label="Updated 15 Jan 2026" size="small" sx={{ display: 'flex', width: 'fit-content', mb: 2.5, boxShadow: 'var(--neu-subtle)' }} />
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>On this page</Typography>
            <Stack component="nav" spacing={0.35} sx={{ mt: 1.5 }}>
              {sections.map((section) => (
                <Typography
                  component="a"
                  href={`#${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  key={section.title}
                  sx={{ px: 1.25, py: 0.8, borderRadius: SHAPE.sm, color: 'text.secondary', fontSize: '0.78rem', textDecoration: 'none', '&:hover': { color: 'primary.main', boxShadow: 'var(--neu-inset)' } }}
                >
                  {section.title.replace(/^\d+\.\s*/, '')}
                </Typography>
              ))}
            </Stack>
          </Box>

          <Box sx={{ borderRadius: SHAPE.card, bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', px: { xs: 3, sm: 5, md: 7 }, py: { xs: 4, md: 7 } }}>
            <Typography sx={{ maxWidth: 760, color: 'text.secondary', fontSize: { xs: '1rem', md: '1.08rem' }, lineHeight: 1.85, mb: 6 }}>
              {introduction}
            </Typography>

            <Stack spacing={{ xs: 4.5, md: 6 }}>
              {sections.map((section) => (
                <Box id={section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')} key={section.title} sx={{ scrollMarginTop: 100 }}>
                  <Typography component="h2" sx={{ fontSize: { xs: '1.3rem', md: '1.55rem' }, fontWeight: 800, letterSpacing: '-.02em', mb: 1.5 }}>
                    {section.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.85, whiteSpace: 'pre-line' }}>
                    {section.content}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Box sx={{ mt: { xs: 6, md: 8 }, p: { xs: 2.5, md: 3.5 }, borderRadius: SHAPE.card, bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-inset)' }}>
              <Typography variant="overline" color="secondary.dark">Need clarification?</Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.7 }}>{contact}</Typography>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
