import ProductIllustration from '../ProductIllustration'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import { SHAPE } from '@ubuntu-fund/ui'
import { featureGroups } from '../../data/features'

const features = featureGroups.map(group => ({ icon: group.icon, title: group.title, description: group.description, id: group.id }))

function FeaturesSection() {
  return (
    <Box
      id="features"
      sx={{
        py: { xs: 8, md: 10 },
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.dark' }}
          >
            Why Ujimora
          </Typography>
          <Typography
            variant="h2"
            sx={{
              mt: 1,
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
            }}
          >
            Built for Ghana, by Ghanaians
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 640, mx: 'auto' }}
          >
            Purpose-built features for how fundraising actually works in Ghana —
            at home and among Ghanaians abroad.
          </Typography>
        </Box>

        <Grid container spacing={4} sx={{ mb: 6 }}>
          <Grid size={{ xs: 12, md: 7 }}><ProductIllustration screen="campaign" caption="Campaign goals, progress, and sharing in one place" /></Grid>
          <Grid size={{ xs: 12, md: 5 }} sx={{ alignSelf: 'center' }}>
            <Typography variant="h4" sx={{ mb: 2 }}>Give every cause room to grow</Typography>
            <Typography sx={{ color: 'text.secondary', mb: 3 }}>A clear goal, a story worth sharing, and a community ready to help. Bring them together and build something that lasts.</Typography>
            <ProductIllustration screen="workspace" caption="Campaign and donation activity" />
          </Grid>
        </Grid>
        <Grid container spacing={3}>
          {features.map((feature) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.title}>
              <Card sx={{ height: '100%' }} elevation={0}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: SHAPE.sm,
                      backgroundColor: 'var(--neu-surface)',
                      boxShadow: 'var(--neu-subtle)',
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2.5,
                    }}
                  >
                    <feature.icon sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    {feature.description}
                  </Typography>
                  <Button href={`/features#${feature.id}`} sx={{ mt: 2 }}>Explore features</Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default FeaturesSection
