import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export interface BrandLogoProps {
  /** Tile size in px. Wordmark scales with it. */
  size?: number
  /** Render the "UbuntuFund" wordmark next to the tile. */
  withWordmark?: boolean
  /** Set when the logo sits on a dark (forest) surface. */
  onDark?: boolean
}

/**
 * The canonical UbuntuFund mark: a forest tile with a single sharp corner
 * (bottom-left), gold hairline border, and the UF monogram in TT Squares —
 * paired with the Ubuntu(cream/ink) + Fund(gold) wordmark.
 */
export function BrandLogo({ size = 36, withWordmark = true, onDark = false }: BrandLogoProps) {
  const radius = Math.round(size * 0.3)
  const sharp = Math.max(2, Math.round(size * 0.04))

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.035 }}>
      <Box
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: `${radius}px ${radius}px ${radius}px ${sharp}px`,
          bgcolor: '#2E3D2F',
          border: `${Math.max(1.5, size * 0.028)}px solid #C7A24A`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"TT Squares", sans-serif',
          fontWeight: 900,
          fontSize: size * 0.38,
          color: '#C7A24A',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        UF
      </Box>
      {withWordmark && (
        <Typography
          component="span"
          sx={{
            fontFamily: '"TT Squares", sans-serif',
            fontWeight: 700,
            fontSize: size * 0.62,
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
