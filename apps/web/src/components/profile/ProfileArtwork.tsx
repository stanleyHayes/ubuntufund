import Box from '@mui/material/Box'

/** Decorative fallback artwork, inheriting the active skin's palette. */
export function ProfileArtwork({ variant = 'person' }: { variant?: 'person' | 'organization' | 'cover' }) {
  if (variant === 'cover') return <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, color: 'primary.main', pointerEvents: 'none', overflow: 'hidden' }}>
    <svg width="100%" height="100%" viewBox="0 0 1200 320" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M0 245C180 130 310 345 560 230S930 65 1200 175V320H0Z" fill="currentColor" opacity=".045" />
      <path d="M0 300C300 140 440 380 700 225S1000 160 1200 225" stroke="currentColor" strokeWidth="2" opacity=".1" />
      <circle cx="980" cy="95" r="120" fill="#C7A24A" opacity=".10" />
      <g stroke="currentColor" strokeWidth="3" opacity=".14">
        <rect x="755" y="50" width="122" height="122" rx="28" transform="rotate(35 816 111)" />
        <rect x="850" y="90" width="122" height="122" rx="28" transform="rotate(35 911 151)" />
        <path d="m1020 195 26-26 26 26-26 26zM670 90l14-14 14 14-14 14z" />
      </g>
      <g fill="#C7A24A" opacity=".25"><circle cx="725" cy="236" r="6"/><circle cx="1088" cy="65" r="8"/><circle cx="614" cy="145" r="4"/></g>
    </svg>
  </Box>
  return <Box aria-hidden="true" sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', bgcolor: 'background.paper', color: 'primary.main' }}>
    <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
      <circle cx="78" cy="22" r="30" fill="#C7A24A" opacity=".18" />
      <path d="M0 77Q42 50 100 85V100H0Z" fill="currentColor" opacity=".08" />
      {variant === 'organization' ? <g stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="m22 40 28-17 28 17H22ZM28 46v25m15-25v25m14-25v25m15-25v25M22 78h56" />
        <path d="M45 32h10" stroke="#C7A24A" />
      </g> : <g>
        <circle cx="50" cy="35" r="14" fill="currentColor" opacity=".8" />
        <path d="M24 80v-7c0-14 11-23 26-23s26 9 26 23v7" fill="currentColor" opacity=".7" />
        <path d="M81 56v16m-8-8h16" stroke="#C7A24A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>}
    </svg>
  </Box>
}
