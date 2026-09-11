import { Box, Button, Card, CardContent, Chip, Container, Typography } from '@mui/material'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import VolunteerActivismRounded from '@mui/icons-material/VolunteerActivismRounded'
import { InternalPageHero } from '../components/InternalPageHero'
import ProductIllustration from '../components/ProductIllustration'
import { useColorMode } from '../context/ColorModeContext'
import { featureGroups } from '../data/features'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'
import { breadcrumbList } from '@ubuntu-fund/ui'

const webUrl = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:8200'

const illustrations = {
  creators: { screen: 'create', caption: 'A little appreciation can start something meaningful.' },
  campaigns: { screen: 'workspace', caption: 'Many hands. One shared purpose.' },
  growth: { screen: 'campaign', caption: 'Small contributions. Room to grow.' },
} as const

export default function FeaturesPage() {
  useSeo({
    title: 'Features for campaigns, creators and teams | Ujimora',
    description: "Explore Ujimora's tools: campaign updates and collaboration, creator tip jars, contributions and payouts, verification checks, referrals and themes.",
    path: '/features',
    type: 'website',
    jsonLd: breadcrumbList(SITE_ORIGIN, [{ name: 'Home', path: '/' }, { name: 'Features' }]),
  })
  const { darkMode } = useColorMode()
  return (
    <>
      <InternalPageHero
        eyebrow="Explore Ujimora"
        title="More ways to give. More room to grow."
        description="Raise funds for a cause, receive support for your creative work, or bring your organisation together. Discover the tools that make it possible."
        icon={<VolunteerActivismRounded />}
        panelLabel="Meet the creator tip jar"
        panelTitle="Give your supporters a place to say thank you."
        panelBody="Included with active paid plans: a shareable creator page, tips from your community, and withdrawals at your plan’s platform-fee rate."
        primaryAction={{ label: 'Create your account', href: `${webUrl}/register` }}
        secondaryAction={{ label: 'Compare plans', href: '/pricing' }}
      />
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Box component="nav" aria-label="Feature categories" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 6 }}>
          {featureGroups.map(group => <Chip key={group.id} component="a" href={`#${group.id}`} clickable icon={<group.icon />} label={group.id === 'personalise' ? 'Appearance' : group.id.charAt(0).toUpperCase() + group.id.slice(1)} />)}
        </Box>
        {featureGroups.map((group, index) => {
          const illustration = illustrations[group.id as keyof typeof illustrations]
          return (
          <Box component="section" id={group.id} key={group.id} sx={{ scrollMarginTop: 110, py: { xs: 4, md: 6 }, borderTop: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.6fr' }, gap: { xs: 3, md: 7 }, alignItems: 'start' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary', mb: 2 }}><group.icon /><Typography variant="overline">0{index + 1} / {group.id}</Typography></Box>
              <Typography component="h2" variant="h4" sx={{ mb: 2 }}>{group.title}</Typography>
              <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>{group.description}</Typography>
              {illustration && (
                <Box component="figure" sx={{ m: 0, mb: 2.5, maxWidth: 300 }}>
                  <ProductIllustration screen={illustration.screen} dark={darkMode} />
                  <Typography component="figcaption" sx={{ mt: .5, color: 'text.secondary', fontSize: '.75rem', textAlign: 'center', lineHeight: 1.6 }}>{illustration.caption}</Typography>
                </Box>
              )}
              <Button href={group.marketing ? group.path : `${webUrl}${group.path}`} endIcon={<ArrowForwardRounded />}>{group.action}</Button>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: group.id === 'creators' ? '1fr' : '1fr 1fr' }, gap: 2, alignContent: 'start' }}>
              {group.features.map(([title, description]) => (
                <Card key={title} elevation={0} sx={{ height: '100%', position: 'relative', overflow: 'hidden', ...(group.features.length % 2 === 1 ? { '&:last-child': { gridColumn: '1 / -1' } } : {}) }}>
                  <CardContent sx={{ p: 3, position: 'relative' }}>
                    <group.icon aria-hidden="true" sx={{ position: 'absolute', right: 12, bottom: 10, fontSize: 84, color: 'text.primary', opacity: .035, pointerEvents: 'none' }} />
                    <Typography component="h3" variant="h6" sx={{ mb: 1 }}>{title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>{description}</Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )})}
        <Box sx={{ textAlign: 'center', py: 5, mt: 3 }}>
          <Typography variant="h4" component="h2" sx={{ mb: 2 }}>Find the right fit for your cause.</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Check the current plans for pricing, limits, and feature availability.</Typography>
          <Button variant="contained" href="/pricing" endIcon={<ArrowForwardRounded />}>Explore plans</Button>
        </Box>
      </Container>
    </>
  )
}
