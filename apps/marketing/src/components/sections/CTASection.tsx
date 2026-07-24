import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'

function CTASection() {
  return (
    <Box
      sx={{
        py: { xs: 8, md: 10 },
        textAlign: 'center',
        backgroundColor: '#F2EFEA',
      }}
    >
      <Container maxWidth="md">
        <Typography variant="overline" sx={{ color: 'secondary.dark' }}>
          Get involved
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
          Ready to make a difference?
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            maxWidth: 640,
            mx: 'auto',
            mb: 4,
          }}
        >
          Join thousands of Ghanaians at home and abroad funding what their
          communities need through the power of collective giving.
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
        >
          <Button
            variant="contained"
            color="secondary"
            size="large"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700, borderRadius: '999px' }}
          >
            Start your campaign
          </Button>
          <Button
            variant="outlined"
            color="primary"
            size="large"
            startIcon={<FavoriteRoundedIcon />}
            sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700, borderRadius: '999px' }}
          >
            Explore campaigns
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
