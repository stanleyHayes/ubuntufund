import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import { Link as RouterLink } from 'react-router-dom'

export function Header() {
  return (
    <AppBar position="sticky" color="default" elevation={1} sx={{ bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2 }}>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              fontWeight: 700,
              color: 'primary.main',
              textDecoration: 'none',
              mr: 4,
            }}
          >
            UbuntuFund
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
            <Button component={RouterLink} to="/" color="inherit">
              Home
            </Button>
            <Button component={RouterLink} to="/#campaigns" color="inherit">
              Campaigns
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button component={RouterLink} to="/login" variant="outlined" color="primary">
              Login
            </Button>
            <Button component={RouterLink} to="/register" variant="contained" color="primary">
              Register
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  )
}
