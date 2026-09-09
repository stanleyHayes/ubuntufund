import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { AccountPageSkeleton } from './account/AccountPage'

/** Route-loading fallback: visible immediately, with no artificial delay. */
export function SplashScreen() {
  return (
    <Box role="status" aria-label="Loading Ujimora" aria-busy="true" sx={{ minHeight: '100dvh', bgcolor: 'background.default', color: 'text.primary' }}>
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Skeleton width={150} height={36} /><Skeleton variant="circular" width={40} height={40} />
      </Box>
      <AccountPageSkeleton layout="cards" />
    </Box>
  )
}
