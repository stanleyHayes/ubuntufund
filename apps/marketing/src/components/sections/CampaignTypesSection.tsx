import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'

const campaignTypes = [
  {
    emoji: '🏥',
    title: 'Medical',
    description: 'Healthcare costs, surgeries, treatments, and medical emergencies.',
    gradient: 'linear-gradient(135deg, #E53935, #EF5350)',
  },
  {
    emoji: '🎓',
    title: 'Education',
    description: 'School fees, scholarships, learning materials, and university funding.',
    gradient: 'linear-gradient(135deg, #1565C0, #42A5F5)',
  },
  {
    emoji: '🚨',
    title: 'Emergency',
    description: 'Disaster relief, urgent needs, and crisis response for communities.',
    gradient: 'linear-gradient(135deg, #E65100, #FF9800)',
  },
  {
    emoji: '💼',
    title: 'Business',
    description: 'Startups, small businesses, cooperatives, and entrepreneurial ventures.',
    gradient: 'linear-gradient(135deg, #2E7D32, #4CAF50)',
  },
  {
    emoji: '🏘️',
    title: 'Community',
    description: 'Infrastructure, clean water, sanitation, and community development projects.',
    gradient: 'linear-gradient(135deg, #6A1B9A, #AB47BC)',
  },
  {
    emoji: '⛪',
    title: 'Religious',
    description: 'Places of worship, religious events, missions, and faith-based initiatives.',
    gradient: 'linear-gradient(135deg, #4E342E, #8D6E63)',
  },
  {
    emoji: '🎨',
    title: 'Creative',
    description: 'Arts, music, film, cultural projects, and creative endeavors across Africa.',
    gradient: 'linear-gradient(135deg, #AD1457, #EC407A)',
  },
]

function CampaignTypesSection() {
  return (
    <Box
      sx={{
        py: { xs: 8, md: 12 },
        backgroundColor: '#FAFAF5',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.main', fontWeight: 700, letterSpacing: 2, fontSize: '0.85rem' }}
          >
            Campaign Categories
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
            Fundraise for Any Cause
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto' }}
          >
            Whether it is a medical emergency, education funding, or a community project,
            UbuntuFund supports campaigns across every category that matters.
          </Typography>
        </Box>

        <Grid container spacing={3} justifyContent="center">
          {campaignTypes.map((type) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={type.title}>
              <Card
                sx={{
                  height: '100%',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                    '& .campaign-type-icon': {
                      transform: 'scale(1.1)',
                    },
                  },
                }}
                elevation={0}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    className="campaign-type-icon"
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: type.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                      fontSize: '2rem',
                      transition: 'transform 0.3s ease',
                    }}
                  >
                    {type.emoji}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, fontSize: '1rem' }}>
                    {type.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      lineHeight: 1.6,
                      display: { xs: 'none', sm: 'block' },
                    }}
                  >
                    {type.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default CampaignTypesSection
