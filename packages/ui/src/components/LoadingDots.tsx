import Box from '@mui/material/Box'
import { keyframes } from '@mui/system'

const bounce = keyframes`
  0%, 80%, 100% { transform: scale(0.55); opacity: 0.45; }
  40%          { transform: scale(1);    opacity: 1; }
`

export interface LoadingDotsProps {
  /** Dot diameter in px (default 6). */
  size?: number
  /** Dot color (default inherits the button/text color). */
  color?: string
}

/**
 * Three bouncing dots — the platform's standard in-button loading indicator.
 * Use SKELETONS for page/section loads; use these dots only inside buttons.
 * Defaults to `currentColor` so it matches whatever button it sits in.
 */
export function LoadingDots({ size = 6, color = 'currentColor' }: LoadingDotsProps) {
  return (
    <Box
      component="span"
      role="status"
      aria-label="Loading"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: `${Math.max(3, Math.round(size * 0.7))}px` }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          component="span"
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: color,
            animation: `${bounce} 1.2s ${i * 0.15}s infinite ease-in-out both`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.7 },
          }}
        />
      ))}
    </Box>
  )
}
