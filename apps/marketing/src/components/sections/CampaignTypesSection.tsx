import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import SchoolIcon from '@mui/icons-material/School'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter'
import HolidayVillageIcon from '@mui/icons-material/HolidayVillage'
import ChurchIcon from '@mui/icons-material/Church'
import PaletteIcon from '@mui/icons-material/Palette'
import { SHAPE } from '@ubuntu-fund/ui'

const campaignTypes = [
  {
    icon: LocalHospitalIcon,
    title: 'Medical',
    description: 'Healthcare costs, surgeries, treatments, and medical emergencies.',
    accent: '#2E3D2F',
  },
  {
    icon: SchoolIcon,
    title: 'Education',
    description: 'School fees, scholarships, learning materials, and university funding.',
    accent: '#C7A24A',
  },
  {
    icon: WarningAmberIcon,
    title: 'Emergency',
    description: 'Disaster relief, urgent needs, and crisis response for communities.',
    accent: '#2E3D2F',
  },
  {
    icon: BusinessCenterIcon,
    title: 'Business',
    description: 'Startups, small businesses, cooperatives, and entrepreneurial ventures.',
    accent: '#C7A24A',
  },
  {
    icon: HolidayVillageIcon,
    title: 'Community',
    description: 'Infrastructure, clean water, sanitation, and community development projects.',
    accent: '#2E3D2F',
  },
  {
    icon: ChurchIcon,
    title: 'Religious',
    description: 'Places of worship, religious events, missions, and faith-based initiatives.',
    accent: '#C7A24A',
  },
  {
    icon: PaletteIcon,
    title: 'Creative',
    description: 'Arts, music, film, cultural projects, and creative work across Ghana.',
    accent: '#2E3D2F',
  },
]

function CampaignTypesSection() {
  return (
    <Box
      id="campaign-types"
      sx={{
        py: { xs: 8, md: 10 },
        backgroundColor: '#F2EFEA',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.dark' }}
          >
            Campaign categories
          </Typography>
          <Typography
            variant="h2"
            sx={{
              mt: 1,
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
            }}
          >
            Fundraise for any cause
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 640, mx: 'auto' }}
          >
            Whether it is a medical emergency, education funding, or a community project,
            UbuntuFund supports campaigns across every category that matters.
          </Typography>
        </Box>

        <Grid container spacing={3} justifyContent="center">
          {campaignTypes.map((type) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={type.title}>
              <Card sx={{ height: '100%', textAlign: 'center' }} elevation={0}>
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: SHAPE.sm,
                      backgroundColor: `${type.accent}14`,
                      color: type.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <type.icon sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1, fontSize: '1rem' }}>
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
