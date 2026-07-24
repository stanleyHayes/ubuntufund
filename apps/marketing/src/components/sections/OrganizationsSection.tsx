import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { SHAPE } from '@ubuntu-fund/ui'

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
        py: { xs: 8, md: 10 },
        background: 'linear-gradient(160deg, #1C261D 0%, #2E3D2F 100%)',
        color: '#fff',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="overline" sx={{ color: 'secondary.main' }}>
              For organizations
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
              Supercharge your impact
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
              lasting donor relationships across Ghana and beyond.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700, borderRadius: '999px' }}
            >
              Get started for organizations
            </Button>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                backgroundColor: 'rgba(46,61,47,0.55)',
                borderRadius: SHAPE.card,
                p: { xs: 2, md: 3 },
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <List dense>
                {benefits.map((benefit) => (
                  <ListItem key={benefit} sx={{ py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleRoundedIcon sx={{ color: 'secondary.main', fontSize: 22 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={benefit}
                      slotProps={{
                        primary: { sx: { color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' } },
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
