import Box from '@mui/material/Box'

/** Original decorative linework; not a representation of a traditional symbol. */
export default function HomeWatermark({ variant = 'chain' }: { variant?: 'chain' | 'leaf' | 'ripple' }) {
  return (
    <Box component="svg" viewBox="0 0 400 400" aria-hidden="true" focusable="false"
      sx={{ position: 'absolute', right: { xs: -110, md: -35 }, top: 0, width: { xs: 250, md: 390 }, color: '#C7A24A', opacity: 0.12, pointerEvents: 'none' }}>
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        {variant === 'chain' && [0, 1, 2, 3, 4].map(i => <rect key={i} x={60 + i * 28} y={60 + i * 28} width="145" height="145" rx="25" transform={`rotate(45 ${132 + i * 28} ${132 + i * 28})`} />)}
        {variant === 'leaf' && <><path d="M80 350Q110 200 310 50Q350 265 80 350ZM80 350L310 50" />{[0, 1, 2, 3].map(i => <path key={i} d={`M${125 + i * 35} ${285 - i * 48}q-12 -55 18 -88m-18 88q70 8 110 -32`} />)}</>}
        {variant === 'ripple' && <>{[50, 85, 120, 155, 190].map(r => <ellipse key={r} cx="200" cy="200" rx={r} ry={r * 0.6} transform="rotate(-30 200 200)" />)}<path d="M200 15v370M15 200h370" strokeDasharray="3 12" /></>}
      </g>
    </Box>
  )
}
