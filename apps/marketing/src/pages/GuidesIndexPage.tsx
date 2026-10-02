import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import { SHAPE, breadcrumbList } from '@ubuntu-fund/ui'
import { InternalPageHero } from '../components/InternalPageHero'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'
import { GUIDE_GROUPS, GUIDES, GUIDES_INDEX } from '@/data/guides'
import { GUIDE_ICONS } from './GuidePage'

const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'https://app.ujimora.com'

/** /guides: every search guide, grouped, so each one is a click from the hub. */
export default function GuidesIndexPage() {
  useSeo({
    title: GUIDES_INDEX.title,
    description: GUIDES_INDEX.description,
    path: GUIDES_INDEX.path,
    jsonLd: [
      breadcrumbList(SITE_ORIGIN, [{ name: 'Home', path: '/' }, { name: 'Guides' }]),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: GUIDES_INDEX.name,
        itemListElement: GUIDES.map((guide, index) => ({ '@type': 'ListItem', position: index + 1, name: guide.name, url: `${SITE_ORIGIN}${guide.path}` })),
      },
    ],
  })

  return (
    <>
      <InternalPageHero
        eyebrow="Guides"
        title="Fundraising guides for Ghana"
        description="Everything you need to raise money well, or to give with confidence: how crowdfunding works here, how to start a campaign, and what to know for each kind of cause."
        icon={<MenuBookRoundedIcon />}
        panelLabel="Written for Ghana"
        panelTitle="Cedis, mobile money, WhatsApp groups and family abroad."
        panelBody="Practical answers, checked against how Ujimora actually works."
        primaryAction={{ label: 'Start a campaign', href: `${WEB_APP_URL}/campaigns/new` }}
        secondaryAction={{ label: 'Browse campaigns', href: `${WEB_APP_URL}/explore` }}
      />
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        {GUIDE_GROUPS.map((group) => (
          <Box component="section" key={group.id} aria-labelledby={`guides-${group.id}`} sx={{ mb: { xs: 7, md: 9 } }}>
            <Typography id={`guides-${group.id}`} variant="h4" component="h2" sx={{ fontWeight: 800 }}>{group.heading}</Typography>
            <Typography sx={{ color: 'text.secondary', mt: 1, mb: 3 }}>{group.intro}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5 }}>
              {GUIDES.filter((guide) => guide.group === group.id).map((guide) => (
                <Box
                  component="a"
                  key={guide.path}
                  href={guide.path}
                  sx={{
                    display: 'flex', flexDirection: 'column', gap: 1.25, p: 3, borderRadius: SHAPE.card,
                    bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-subtle)', border: 'var(--neu-border)',
                    color: 'text.primary', textDecoration: 'none', transition: 'box-shadow .2s ease, transform .2s ease',
                    '&:hover': { boxShadow: 'var(--neu-raised)', transform: 'translateY(-2px)' },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 },
                  }}
                >
                  <Box aria-hidden sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: SHAPE.sm, boxShadow: 'var(--neu-inset)', color: 'primary.main', '& svg': { fontSize: 22 } }}>
                    {GUIDE_ICONS[guide.icon]}
                  </Box>
                  <Typography component="h3" variant="h6" sx={{ fontWeight: 750, lineHeight: 1.3 }}>{guide.name}</Typography>
                  <Typography component="span" sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: '.95rem' }}>{guide.summary}</Typography>
                  <Typography component="span" sx={{ mt: 'auto', pt: 1, color: 'primary.main', fontWeight: 700, fontSize: '.9rem', display: 'inline-flex', alignItems: 'center', gap: .75 }}>
                    Read the guide <ArrowForwardRoundedIcon aria-hidden sx={{ fontSize: 18 }} />
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Container>
    </>
  )
}
