import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { CampaignForm } from '@/components/campaigns/CampaignForm'

export function CreateCampaignPage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 800 }}>
          Start a Campaign
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 480, mx: 'auto' }}>
          Tell your story, set a goal, and upload evidence. Your campaign will be reviewed before going live.
        </Typography>
      </Box>
      <CampaignForm />
    </Container>
  )
}
