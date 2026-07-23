import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 2,
            p: { xs: 3, sm: 4 },
            boxShadow: '0 2px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          {children}
        </Box>
      </Container>
    </Box>
  )
}
