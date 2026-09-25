import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import { Link as RouterLink } from 'react-router-dom'

/**
 * States which terms govern a donation and the minimum age, next to the pay
 * button. Informational only: whether guests must actively accept (a checkbox
 * or clickwrap consent record) is an owner/legal decision still open, so this
 * records nothing and blocks nothing.
 */
export function DonationTermsNotice() {
  return (
    <Typography variant="caption" component="p" color="text.secondary" sx={{ textAlign: 'center', mb: 1.5 }}>
      Donations are made under our{' '}
      <Link component={RouterLink} to="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</Link>,{' '}
      <Link component={RouterLink} to="/contributor-terms" target="_blank" rel="noopener noreferrer">Contributor Terms</Link> and{' '}
      <Link component={RouterLink} to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</Link>.
      You must be 18 or older to donate.
    </Typography>
  )
}
