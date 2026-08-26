import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import { useEffect, useState } from 'react'
import { NEUMORPHIC_WHITE_VARS } from '@ubuntu-fund/ui'

interface TestimonialContent {
  id: string
  name: string
  role: string
  location: string
  quote: string
}

const testimonials = [
  {
    name: 'Evidence before promotion',
    role: 'Campaign review principle',
    quote:
      'Campaigns move through a review workflow before publication, giving administrators a clear place to assess the story, goal, and supporting details.',
  },
  {
    name: 'Records remain accountable',
    role: 'Data handling principle',
    quote:
      'User-facing deletion is implemented as soft deletion so operational records can be retained for review without remaining active in the product.',
  },
  {
    name: 'No false checkout',
    role: 'Payment readiness principle',
    quote:
      'Only the internal UbuntuFund Wallet flow is available during launch readiness. External payment methods stay disabled until verified provider adapters are connected.',
  },
]

function TestimonialsSection() {
  const [publishedTestimonials, setPublishedTestimonials] = useState<TestimonialContent[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/testimonials', { headers: { Accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Request failed')))
      .then((body) => { if (!cancelled && Array.isArray(body?.data)) setPublishedTestimonials(body.data) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const items = publishedTestimonials.length > 0 ? publishedTestimonials : testimonials
  return (
    <Box
      id="testimonials"
      sx={{
        py: { xs: 8, md: 10 },
        backgroundColor: '#FFFFFF',
        ...NEUMORPHIC_WHITE_VARS,
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography variant="overline" sx={{ color: 'secondary.dark' }}>
            Product commitments
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 700,
              mt: 1,
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
            }}
          >
            Trust starts with honest operations
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 640, mx: 'auto' }}
          >
            These are the operating principles built into the platform today—not
            invented customer outcomes or launch metrics.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {items.map((testimonial) => (
            <Grid size={{ xs: 12, md: 4 }} key={testimonial.name}>
              <Card sx={{ height: '100%' }} elevation={0}>
                <CardContent sx={{ p: 4 }}>
                  <FormatQuoteRoundedIcon
                    sx={{
                      fontSize: 36,
                      color: 'rgba(46, 61, 47, 0.15)',
                      mb: 1,
                    }}
                  />
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'text.secondary',
                      lineHeight: 1.8,
                      mb: 3,
                      fontStyle: 'italic',
                    }}
                  >
                    "{testimonial.quote}"
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {testimonial.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {testimonial.role}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default TestimonialsSection
