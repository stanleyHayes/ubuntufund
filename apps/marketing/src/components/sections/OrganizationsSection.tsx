import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

const benefits = [
  'Dedicated organization dashboard with team management',
  'Branded campaign pages with your logo and colors',
  'Advanced analytics and donor relationship tools',
  'Automated tax receipts and compliance reporting',
  'Bulk donation processing and recurring giving plans',
  'Priority verification and enhanced trust badges',
  'API access for integration with your existing systems',
  'Dedicated account manager and priority support',
]

function OrganizationsSection() {
  return (
    <Box
      id="organizations"
      sx={{
        py: { xs: 8, md: 12 },
        background: 'linear-gradient(135deg, #1C261D 0%, #2E3D2F 100%)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(circle at 90% 20%, rgba(199, 162, 74,0.12) 0%, transparent 50%)',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={6} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography
              variant="overline"
              sx={{ color: '#C7A24A', fontWeight: 700, letterSpacing: 2, fontSize: '0.85rem' }}
            >
              For Organizations
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 700,
                mt: 1,
                mb: 2,
                color: '#fff',
                fontSize: { xs: '1.75rem', md: '2.25rem' },
              }}
            >
              Supercharge Your Impact
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(255,255,255,0.8)',
                mb: 4,
                lineHeight: 1.7,
                maxWidth: 500,
              }}
            >
              Whether you are an NGO, hospital, school, or religious institution,
              UbuntuFund provides the tools to scale your fundraising and build
              lasting donor relationships across Africa and beyond.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700 }}
            >
              Get Started for Organizations
            </Button>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                backgroundColor: 'rgba(46,61,47,0.55)',
                borderRadius: 3,
                p: { xs: 2, md: 3 },
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <List dense>
                {benefits.map((benefit) => (
                  <ListItem key={benefit} sx={{ py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon sx={{ color: '#C7A24A', fontSize: 22 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={benefit}
                      primaryTypographyProps={{
                        sx: { color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

export default OrganizationsSection
