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

const campaignTypes = [
  {
    icon: LocalHospitalIcon,
    title: 'Medical',
    description: 'Healthcare costs, surgeries, treatments, and medical emergencies.',
    gradient: 'linear-gradient(135deg, #A5432F, #C06B58)',
  },
  {
    icon: SchoolIcon,
    title: 'Education',
    description: 'School fees, scholarships, learning materials, and university funding.',
    gradient: 'linear-gradient(135deg, #4A6B75, #74909A)',
  },
  {
    icon: WarningAmberIcon,
    title: 'Emergency',
    description: 'Disaster relief, urgent needs, and crisis response for communities.',
    gradient: 'linear-gradient(135deg, #B98A2E, #D3A95C)',
  },
  {
    icon: BusinessCenterIcon,
    title: 'Business',
    description: 'Startups, small businesses, cooperatives, and entrepreneurial ventures.',
    gradient: 'linear-gradient(135deg, #2E3D2F, #5E8F72)',
  },
  {
    icon: HolidayVillageIcon,
    title: 'Community',
    description: 'Infrastructure, clean water, sanitation, and community development projects.',
    gradient: 'linear-gradient(135deg, #6A1B9A, #AB47BC)',
  },
  {
    icon: ChurchIcon,
    title: 'Religious',
    description: 'Places of worship, religious events, missions, and faith-based initiatives.',
    gradient: 'linear-gradient(135deg, #4E342E, #8D6E63)',
  },
  {
    icon: PaletteIcon,
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
        backgroundColor: '#F2EFEA',
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
                  transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
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
                    }}
                  >
                    <type.icon sx={{ fontSize: '2rem', color: '#fff' }} />
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
