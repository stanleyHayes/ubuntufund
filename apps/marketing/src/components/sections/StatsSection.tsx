import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'

const stats = [
  { value: '$10M+', label: 'Raised on Platform', color: '#2E3D2F' },
  { value: '50K+', label: 'Campaigns Created', color: '#C7A24A' },
  { value: '30+', label: 'African Countries', color: '#2E3D2F' },
  { value: '99%', label: 'Trust Rate', color: '#C7A24A' },
]

function StatsSection() {
  return (
    <Box
      sx={{
        py: { xs: 6, md: 8 },
        backgroundColor: '#fff',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {stats.map((stat) => (
            <Grid size={{ xs: 6, md: 3 }} key={stat.label}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 800,
                    color: stat.color,
                    fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                    mb: 0.5,
                  }}
                >
                  {stat.value}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ color: 'text.secondary', fontWeight: 500 }}
                >
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
