import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import FavoriteIcon from '@mui/icons-material/Favorite'

function CTASection() {
  return (
    <Box
      sx={{
        py: { xs: 8, md: 12 },
        textAlign: 'center',
        backgroundColor: '#F2EFEA',
      }}
    >
      <Container maxWidth="md">
        <Typography
          sx={{ fontSize: '3.5rem', mb: 2, lineHeight: 1 }}
        >
          🤝
        </Typography>
        <Typography
          variant="h2"
          sx={{
            fontWeight: 800,
            mb: 2,
            fontSize: { xs: '1.75rem', md: '2.5rem' },
          }}
        >
          Ready to Make a Difference?
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            maxWidth: 520,
            mx: 'auto',
            mb: 4,
            fontSize: '1.1rem',
            lineHeight: 1.7,
          }}
        >
          Join thousands of Africans and allies building a more connected,
          empowered continent through the power of collective giving.
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
        >
          <Button
            variant="contained"
            color="primary"
            size="large"
            endIcon={<ArrowForwardIcon />}
            sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700 }}
          >
            Start Your Campaign
          </Button>
          <Button
            variant="outlined"
            color="primary"
            size="large"
            startIcon={<FavoriteIcon />}
            sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700 }}
          >
            Explore Campaigns
          </Button>
        </Stack>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', mt: 3 }}
        >
          No platform fees for personal campaigns. Free to get started.
        </Typography>
      </Container>
    </Box>
  )
}

export default CTASection
