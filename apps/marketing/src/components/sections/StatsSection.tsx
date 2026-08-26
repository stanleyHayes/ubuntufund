import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import { useContent } from '../../hooks/useContent'

// Hardcoded default — used as the CMS fallback (key 'marketing.stats').
const STATS_FALLBACK = {
  items: [
    { value: 'GHS', label: 'Launch currency' },
    { value: 'Web + mobile', label: 'Client access' },
    { value: 'Admin-reviewed', label: 'Campaign workflow' },
    { value: 'Soft-delete', label: 'Record policy' },
  ],
}

function StatsSection() {
  const { items: stats } = useContent('marketing.stats', STATS_FALLBACK)

  return (
    <Box
      sx={{
        py: { xs: 8, md: 9 },
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 6 } }}>
          <Typography variant="overline" sx={{ color: '#A07E33' }}>
            Platform foundations
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {stats.map((stat, index) => (
            <Grid size={{ xs: 6, md: 3 }} key={stat.label}>
              <Box
                sx={{
                  textAlign: 'center',
                  px: { xs: 1.5, md: 2.5 },
                  py: { xs: 2.25, md: 3 },
                  borderRadius: 3,
                  backgroundColor: 'var(--neu-surface)',
                  boxShadow: index % 2 === 0 ? 'var(--neu-raised)' : 'var(--neu-subtle)',
                }}
              >
                <Typography
                  variant="h2"
                  sx={{
                    fontSize: stat.value.length > 10
                      ? { xs: '1.15rem', sm: '1.35rem', md: '1.55rem' }
                      : { xs: '1.55rem', sm: '1.9rem', md: '2.2rem' },
                    color: index % 2 === 0 ? 'primary.main' : '#A07E33',
                    mb: 0.5,
                    minHeight: { md: 56 },
                    display: 'grid',
                    placeItems: 'center',
                    lineHeight: 1.1,
                    textWrap: 'balance',
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
