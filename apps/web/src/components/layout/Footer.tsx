import Box from '@mui/material/Box'
import { BrandLogo } from '@ubuntu-fund/ui'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import { Link as RouterLink } from 'react-router-dom'

const LINK_COLUMNS = [
  {
    heading: 'Platform',
    links: [
      { label: 'Explore Campaigns', to: '/explore' },
      { label: 'Organizations', to: '/organizations' },
      { label: 'Leaderboard', to: '/leaderboard' },
      { label: 'Start a Campaign', to: '/campaigns/new' },
    ],
  },
  {
    heading: 'Your Account',
    links: [
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'My Donations', to: '/donations' },
      { label: 'Wallet', to: '/wallet' },
      { label: 'Settings', to: '/settings' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Privacy Policy', to: '/privacy' },
    ],
  },
]

export function Footer() {
  return (
    <Box
      component="footer"
      sx={{ mt: 'auto', bgcolor: '#1C261D', color: 'rgba(245, 242, 234, 0.85)' }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 6 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr 1fr 1fr' },
            gap: { xs: 4, md: 6 },
          }}
        >
          {/* Brand column */}
          <Box>
            <BrandLogo size={32} onDark />

            {/* Unity chain — the brand motif */}
            <Box
              component="svg"
              viewBox="0 0 176 44"
              aria-hidden
              sx={{ width: 132, height: 'auto', display: 'block', mt: 1.5 }}
            >
              {[0, 1, 2, 3].map((i) => (
                <rect
                  key={i}
                  x={8 + i * 42}
                  y={8}
                  width={26}
                  height={26}
                  rx={i % 2 === 0 ? 3 : 10}
                  transform={`rotate(45 ${21 + i * 42} 21)`}
                  fill="none"
                  stroke={i % 2 === 0 ? '#C7A24A' : '#A8B5A0'}
                  strokeWidth={2}
                  opacity={i % 2 === 0 ? 0.9 : 0.65}
                />
              ))}
            </Box>

            <Typography variant="body2" sx={{ mt: 1.5, maxWidth: 280, color: 'rgba(245, 242, 234, 0.65)', lineHeight: 1.6 }}>
              Ghana's trust infrastructure for giving. One chain. Many hands. Ubuntu.
            </Typography>
          </Box>

          {/* Link columns */}
          {LINK_COLUMNS.map((col) => (
            <Box key={col.heading}>
              <Typography
                sx={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  color: '#C7A24A',
                  mb: 1.5,
                }}
              >
                {col.heading}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {col.links.map((link) => (
                  <Link
                    key={link.to}
                    component={RouterLink}
                    to={link.to}
                    underline="none"
                    variant="body2"
                    sx={{
                      color: 'rgba(245, 242, 234, 0.72)',
                      '&:hover': { color: '#C7A24A' },
                      width: 'fit-content',
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            mt: { xs: 4, md: 5 },
            pt: 2.5,
            borderTop: '1px solid rgba(245, 242, 234, 0.12)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Typography variant="body2" sx={{ color: 'rgba(245, 242, 234, 0.55)' }}>
            &copy; {new Date().getFullYear()} UbuntuFund. All rights reserved.
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(245, 242, 234, 0.55)' }}>
            Made with Ubuntu, across Ghana.
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}
