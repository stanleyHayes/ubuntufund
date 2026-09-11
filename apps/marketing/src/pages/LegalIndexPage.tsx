import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import { Link as RouterLink } from 'react-router-dom'
import { SHAPE, breadcrumbList } from '@ubuntu-fund/ui'
import { InternalPageHero } from '../components/InternalPageHero'
import { LEGAL_ENTITY, LEGAL_POLICIES } from '../data/legal'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'

/** The `/legal` hub: one card per policy, linking to its dedicated page. */
function LegalIndexPage() {
  useSeo({
    title: 'Legal policies and agreements | Ujimora',
    description:
      'Every policy that governs Ujimora in one place: terms of use, privacy, organizer and contributor terms, payouts and refunds, acceptable use and cookies.',
    path: '/legal',
    type: 'website',
    jsonLd: breadcrumbList(SITE_ORIGIN, [{ name: 'Home', path: '/' }, { name: 'Legal' }]),
  })

  return (
    <Box sx={{ flex: 1, pb: { xs: 8, md: 12 }, bgcolor: 'background.default' }}>
      <InternalPageHero
        eyebrow="Legal & policies"
        title="Policies & agreements"
        description="Every policy that governs Ujimora — published separately, versioned independently, and written in plain language."
        icon={<MenuBookRoundedIcon />}
        panelLabel="Transparency"
        panelTitle="One home for every term, notice and policy."
        panelBody="Terms, privacy, organizer and contributor terms, payouts and refunds, acceptable use, cookies, and billing."
      />

      <Container maxWidth="lg" sx={{ mt: { xs: 5, md: 8 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: { xs: 2.5, md: 3 },
          }}
        >
          {LEGAL_POLICIES.map((policy) => (
            <Box
              key={policy.slug}
              component={RouterLink}
              to={policy.route}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                p: { xs: 3, md: 3.5 },
                borderRadius: SHAPE.card,
                bgcolor: 'var(--neu-surface)',
                boxShadow: 'var(--neu-raised)',
                color: 'inherit',
                textDecoration: 'none',
                transition: 'box-shadow .2s ease, transform .2s ease',
                '&:hover': { boxShadow: 'var(--neu-raised-hover)', transform: 'translateY(-2px)' },
                '&:hover .legal-card-cta': { gap: 1 },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: SHAPE.sm,
                  color: 'primary.main',
                  boxShadow: 'var(--neu-subtle)',
                }}
              >
                {policy.icon}
              </Box>
              <Typography
                component="h2"
                sx={{ fontSize: '1.12rem', fontWeight: 800, letterSpacing: '-.02em', mt: 0.5 }}
              >
                {policy.navLabel}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: '.9rem', lineHeight: 1.6, flex: 1 }}>
                {policy.summary}
              </Typography>
              <Box
                className="legal-card-cta"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 1,
                  color: 'primary.main',
                  fontSize: '.8rem',
                  fontWeight: 700,
                  transition: 'gap .2s ease',
                }}
              >
                Read policy <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
              </Box>
            </Box>
          ))}
        </Box>

        <Typography
          color="text.secondary"
          sx={{ mt: { xs: 4, md: 6 }, fontSize: '.85rem', textAlign: 'center', lineHeight: 1.7 }}
        >
          Each policy shows its effective date and is versioned independently. Questions about our
          policies? Contact <strong>{LEGAL_ENTITY.emails.legal}</strong>.
        </Typography>
      </Container>
    </Box>
  )
}

export default LegalIndexPage
