import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import { Link as RouterLink } from 'react-router-dom'

export function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        py: 4,
        px: 2,
        mt: 'auto',
        bgcolor: 'grey.100',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            &copy; {new Date().getFullYear()} UbuntuFund. All rights reserved.
          </Typography>

          <Box sx={{ display: 'flex', gap: 3 }}>
            <Link component={RouterLink} to="/" variant="body2" color="text.secondary" underline="hover">
              Home
            </Link>
            <Link component={RouterLink} to="/campaigns/new" variant="body2" color="text.secondary" underline="hover">
              Start a Campaign
            </Link>
            <Link component={RouterLink} to="/dashboard" variant="body2" color="text.secondary" underline="hover">
              Dashboard
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
