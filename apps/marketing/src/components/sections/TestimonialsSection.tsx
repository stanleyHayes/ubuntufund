import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Rating from '@mui/material/Rating'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'

const testimonials = [
  {
    name: 'Amina Okafor',
    role: 'Campaign Creator',
    location: 'Lagos, Nigeria',
    avatar: 'A',
    avatarColor: '#2E3D2F',
    rating: 5,
    quote:
      'UbuntuFund helped me raise funds for my daughter\'s surgery in just two weeks. The trust verification gave our donors confidence, and the M-Pesa integration made receiving funds seamless.',
  },
  {
    name: 'David Mwangi',
    role: 'Recurring Donor',
    location: 'Nairobi, Kenya',
    avatar: 'D',
    avatarColor: '#1565C0',
    rating: 5,
    quote:
      'I live in London but wanted to support causes back home. The diaspora mode and multi-currency support make it incredibly easy to give. I can see exactly where my money goes.',
  },
  {
    name: 'Fatima Diallo',
    role: 'NGO Director',
    location: 'Dakar, Senegal',
    avatar: 'F',
    avatarColor: '#A07E33',
    rating: 5,
    quote:
      'Our organization raised over $50,000 for clean water projects through UbuntuFund. The escrow system and milestone tracking gave our international partners full confidence in the process.',
  },
]

function TestimonialsSection() {
  return (
    <Box
      id="testimonials"
      sx={{
        py: { xs: 8, md: 12 },
        backgroundColor: '#fff',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.main', fontWeight: 700, letterSpacing: 2, fontSize: '0.85rem' }}
          >
            Success Stories
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
            Trusted Across the Continent
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto' }}
          >
            Hear from the people whose lives have been changed through the
            generosity of the UbuntuFund community.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {testimonials.map((testimonial) => (
            <Grid size={{ xs: 12, md: 4 }} key={testimonial.name}>
              <Card
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                    transform: 'translateY(-4px)',
                  },
                }}
                elevation={0}
              >
                <CardContent sx={{ p: 4 }}>
                  <FormatQuoteIcon
                    sx={{
                      fontSize: 40,
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
                  <Rating value={testimonial.rating} readOnly size="small" sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: testimonial.avatarColor,
                        width: 48,
                        height: 48,
                        fontWeight: 700,
                      }}
                    >
                      {testimonial.avatar}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {testimonial.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {testimonial.role} &middot; {testimonial.location}
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
