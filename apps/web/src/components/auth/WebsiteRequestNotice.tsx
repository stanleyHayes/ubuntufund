import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Link from '@mui/material/Link'
import { useAuth } from '@/context/AuthContext'

export function WebsiteRequestNotice() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated || user?.role !== 'organization' || !user.needsWebsite) return null

  return (
    <Alert severity="info" sx={{ m: { xs: 2, md: 3 }, overflowWrap: 'anywhere' }}>
      <AlertTitle>Your website request is saved</AlertTitle>
      Our parent company, Neurodyne Corp Ltd, will contact you about a website for your organization.{' '}
      Visit <Link href="https://neurodyne.dev" target="_blank" rel="noopener noreferrer">neurodyne.dev</Link>{' '}
      or email <Link href="mailto:info@neurodyne.dev">info@neurodyne.dev</Link>.
    </Alert>
  )
}
