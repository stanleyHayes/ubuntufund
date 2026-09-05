import { SHAPE } from '@ubuntu-fund/ui'

export const raisedSurface = {
  bgcolor: 'background.paper',
  borderRadius: SHAPE.card,
  boxShadow: 'var(--neu-raised)',
  minWidth: 0,
}

export const insetSurface = {
  bgcolor: 'background.paper',
  borderRadius: SHAPE.sm,
  boxShadow: 'var(--neu-inset)',
}

export const progressTrack = {
  ...insetSurface,
  width: '100%',
  height: 10,
  p: '2px',
  borderRadius: SHAPE.bar,
  '& > *': { borderRadius: SHAPE.bar },
}
