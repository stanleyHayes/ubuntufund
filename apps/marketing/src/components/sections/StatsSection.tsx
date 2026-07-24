import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'

const stats = [
  { value: '$10M+', label: 'Raised on platform' },
  { value: '50K+', label: 'Campaigns created' },
  { value: '30+', label: 'African countries' },
  { value: '99%', label: 'Trust rate' },
]

function StatsSection() {
  return (
    <Box
      sx={{
        py: { xs: 8, md: 9 },
        backgroundColor: '#fff',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 6 } }}>
          <Typography variant="overline" sx={{ color: '#A07E33' }}>
            Our impact
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {stats.map((stat, index) => (
            <Grid size={{ xs: 6, md: 3 }} key={stat.label}>
              <Box
                sx={{
                  textAlign: 'center',
                  px: { xs: 1, md: 2 },
                  borderLeft: {
                    xs: 'none',
                    md: index === 0 ? 'none' : '1px solid #E7E3D8',
                  },
                }}
              >
                <Typography
                  variant="h2"
                  sx={{
                    fontSize: { xs: '2rem', sm: '2.5rem', md: '2.75rem' },
                    color: index % 2 === 0 ? 'primary.main' : '#A07E33',
                    mb: 0.5,
                  }}
                >
                  {stat.value}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {stat.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default StatsSection
