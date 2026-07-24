import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export interface BrandLogoProps {
  /** Mark height in px. Wordmark scales with it. */
  size?: number
  /** Render the "UbuntuFund" wordmark next to the mark. */
  withWordmark?: boolean
  /** Set when the logo sits on a dark (forest) surface. */
  onDark?: boolean
}

/**
 * The UbuntuFund mark: two interlocked chain links — a sharp-cornered gold
 * diamond woven through a rounded sage one — drawn from the platform's
 * unity-chain motif ("One chain. Many hands. Ubuntu.").
 */
export function BrandLogo({ size = 36, withWordmark = true, onDark = false }: BrandLogoProps) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.032 }}>
      <Box
        component="svg"
        viewBox="0 0 66 48"
        aria-hidden
        sx={{ height: size, width: size * 1.375, display: 'block', flexShrink: 0 }}
      >
        {/* Rounded sage link (back) */}
        <rect
          x={30}
          y={10}
          width={28}
          height={28}
          rx={11}
          transform="rotate(45 44 24)"
          fill="none"
          stroke="#A8B5A0"
          strokeWidth={4}
        />
        {/* Sharp gold link (front) */}
        <rect
          x={8}
          y={10}
          width={28}
          height={28}
          rx={3}
          transform="rotate(45 22 24)"
          fill="none"
          stroke="#C7A24A"
          strokeWidth={4}
        />
        {/* Weave: re-draw a short arc of the sage link over the gold one so
            the links read as interlocked, not stacked. */}
        <path
          d="M 33.5 13.5 A 11 11 0 0 1 38 11.2"
          fill="none"
          stroke="#A8B5A0"
          strokeWidth={4}
          strokeLinecap="round"
          transform="rotate(45 44 24)"
        />
      </Box>
      {withWordmark && (
        <Typography
          component="span"
          sx={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: size * 0.6,
            lineHeight: 1,
            color: onDark ? '#F5F2EA' : '#2E3D2F',
            userSelect: 'none',
          }}
        >
          Ubuntu
          <Box component="span" sx={{ color: '#C7A24A' }}>
            Fund
          </Box>
        </Typography>
      )}
    </Box>
  )
}
