import type { ReactNode } from 'react'
import { Box, Skeleton, Stack, Typography } from '@mui/material'
import { EmptyState } from '@ubuntu-fund/ui'
import { raisedSurface } from '@/lib/surfaces'

export function ReviewQueueToolbar({ children, title, description, icon }: { children: ReactNode; title?: string; description?: string; icon?: ReactNode }) {
  return <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap flexWrap="wrap" spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ ...raisedSurface, position: 'relative', overflow: 'hidden', p: { xs: 2, sm: 2.5 } }}>
    {title && <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}><Typography fontWeight={600}>{title}</Typography><Typography variant="body2" color="text.secondary">{description}</Typography></Box>}
    {icon && <Box aria-hidden="true" sx={{ position: 'absolute', right: 200, top: -24, opacity: .035, pointerEvents: 'none', '& svg': { fontSize: 140 } }}>{icon}</Box>}
    <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap flexWrap="wrap" gap={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ position: 'relative', flex: title ? '0 1 auto' : 1, minWidth: 0, '& .MuiFormControl-root': { flex: { xs: 'none', sm: '1 1 220px' }, minWidth: 0, maxWidth: { xs: 'none', sm: 420 } }, '& > .MuiButton-root': { flexShrink: 0 }, '& > .MuiBox-root': { mb: 0, '& > .MuiButton-root': { width: { xs: '100%', sm: 'auto' } } } }}>{children}</Stack>
  </Stack>
}

/** Shared review-card placeholders: use on initial load and queue/filter refresh. */
export function ReviewQueueSkeleton({ label = 'Loading review queue' }: { label?: string }) {
  return <Stack role="status" aria-label={label} aria-busy="true" spacing={2}>
    {[0, 1, 2].map(row => <Stack key={row} aria-hidden="true" spacing={2} sx={{ ...raisedSurface, p: { xs: 2, sm: 3 }, '@media (prefers-reduced-motion: reduce)': { '& .MuiSkeleton-root': { animation: 'none' } } }}>
      <Stack direction="row" spacing={2} alignItems="center"><Skeleton variant="rounded" width={40} height={40} /><Box sx={{ flex: 1 }}><Skeleton width="45%" height={24} /><Skeleton width="65%" height={16} /></Box><Skeleton variant="rounded" width={78} height={24} /></Stack>
      <Skeleton variant="rounded" height={62} />
      <Stack direction="row" spacing={1}><Skeleton variant="rounded" width={140} height={38} /><Skeleton variant="rounded" width={95} height={38} /></Stack>
    </Stack>)}
  </Stack>
}

export function ReviewQueueEmpty({ title, description, icon, action }: { title: string; description: string; icon: ReactNode; action?: ReactNode }) {
  return <Box sx={{ ...raisedSurface, p: { xs: 2, sm: 3 }, position: 'relative', overflow: 'hidden' }}>
    <Box aria-hidden="true" sx={{ position: 'absolute', right: -20, bottom: -25, opacity: .035, pointerEvents: 'none', '& svg': { fontSize: 190 } }}>{icon}</Box>
    <EmptyState variant="empty" title={title} description={description} action={action} />
  </Box>
}
