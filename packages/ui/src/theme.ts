import { createTheme, type PaletteMode } from '@mui/material/styles'

declare module '@mui/material/styles' {
  interface Palette {
    trust: {
      level1: string
      level2: string
      level3: string
      level4: string
    }
  }
  interface PaletteOptions {
    trust?: {
      level1: string
      level2: string
      level3: string
      level4: string
    }
  }
}

// ---------------------------------------------------------------------------
// Diamond-cut shape system
// ---------------------------------------------------------------------------
// Asymmetric border-radius: sharp on top-left & bottom-right, soft on the
// other two corners.  Creates a subtle parallelogram / tech-panel motif that
// Outfit is the single typeface across the platform (display + body).
//
// Three tiers scale the same ratio to different element sizes:
//   card  — panels, cards, modals, chart containers
//   sm    — chips, badges, icon boxes, small interactive surfaces
//   bar   — progress bars, scrollbar thumbs, thin inline indicators
//   pill  — circular elements keep their natural shape (avatars, dots)
// ---------------------------------------------------------------------------
export const SHAPE = {
  /** Cards, chart panels, modals, list containers */
  card: '4px 16px 4px 16px',
  /** Chips, badges, icon boxes, small interactive surfaces */
  sm: '3px 10px 3px 10px',
  /** Progress bars, scrollbar thumbs, thin indicators */
  bar: '1px 6px 1px 6px',
} as const

export function getNeumorphicTokens(dark = false) {
  const surface = dark ? '#172019' : '#F2EFEA'
  const shadow = dark ? 'rgba(0, 0, 0, 0.48)' : 'rgba(72, 62, 43, 0.16)'
  const highlight = dark ? 'rgba(91, 117, 98, 0.16)' : 'rgba(255,255,255,0.96)'

  return {
    surface,
    raised: `7px 7px 16px ${shadow}, -7px -7px 16px ${highlight}`,
    raisedHover: `10px 10px 22px ${shadow}, -9px -9px 20px ${highlight}`,
    subtle: `4px 4px 10px ${shadow}, -4px -4px 10px ${highlight}`,
    inset: `inset 3px 3px 8px ${shadow}, inset -3px -3px 8px ${highlight}`,
  } as const
}

export const NEUMORPHIC_SMOKE_VARS = {
  '--neu-surface': '#F2EFEA',
  '--neu-raised': '7px 7px 16px rgba(72,62,43,0.16), -7px -7px 16px rgba(255,255,255,0.96)',
  '--neu-raised-hover': '10px 10px 22px rgba(72,62,43,0.19), -9px -9px 20px rgba(255,255,255,1)',
  '--neu-subtle': '4px 4px 10px rgba(72,62,43,0.14), -4px -4px 10px rgba(255,255,255,0.94)',
  '--neu-inset': 'inset 3px 3px 8px rgba(72,62,43,0.15), inset -3px -3px 8px rgba(255,255,255,0.94)',
} as const

export const NEUMORPHIC_WHITE_VARS = {
  '--neu-surface': '#FFFFFF',
  '--neu-raised': '7px 7px 16px rgba(38,55,44,0.13), -7px -7px 16px rgba(255,255,255,1)',
  '--neu-raised-hover': '10px 10px 22px rgba(38,55,44,0.16), -9px -9px 20px rgba(255,255,255,1)',
  '--neu-subtle': '4px 4px 10px rgba(38,55,44,0.11), -4px -4px 10px rgba(255,255,255,1)',
  '--neu-inset': 'inset 3px 3px 8px rgba(38,55,44,0.12), inset -3px -3px 8px rgba(255,255,255,1)',
} as const

export const ttSquaresFontFace = `
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Thin.otf') format('opentype');
    font-weight: 100;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Thin Italic.otf') format('opentype');
    font-weight: 100;
    font-style: italic;
    font-display: swap;
  }
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Light.otf') format('opentype');
    font-weight: 300;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Light italic.otf') format('opentype');
    font-weight: 300;
    font-style: italic;
    font-display: swap;
  }
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Regular.otf') format('opentype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Italic.otf') format('opentype');
    font-weight: 400;
    font-style: italic;
    font-display: swap;
  }
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Bold.otf') format('opentype');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Bold Italic.otf') format('opentype');
    font-weight: 700;
    font-style: italic;
    font-display: swap;
  }
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Black.otf') format('opentype');
    font-weight: 900;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'TT Squares';
    src: url('/fonts/Squares Black Italic.otf') format('opentype');
    font-weight: 900;
    font-style: italic;
    font-display: swap;
  }
  /* Outfit variable font — body text (latin + latin-ext subsets) */
  @font-face {
    font-family: 'Outfit';
    src: url('/fonts/Outfit-Variable-latin.woff2') format('woff2');
    font-weight: 100 900;
    font-style: normal;
    font-display: swap;
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
      U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
      U+2212, U+2215, U+FEFF, U+FFFD;
  }
  @font-face {
    font-family: 'Outfit';
    src: url('/fonts/Outfit-Variable-latin-ext.woff2') format('woff2');
    font-weight: 100 900;
    font-style: normal;
    font-display: swap;
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF,
      U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020,
      U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
`

export function createUjimoraTheme(mode: PaletteMode = 'light') {
  const dark = mode === 'dark'
  const neu = getNeumorphicTokens(dark)
  return createTheme({
  palette: {
    mode,
    // Sage & Neutrals system: deep forest structure, burnished gold action,
    // warm parchment ground. Derived from the brand palette, not framework
    // defaults — semantic states are brand-tinted (clay error, ochre warning).
    primary: {
      main: '#2E3D2F',
      light: '#A8B5A0',
      dark: '#1C261D',
      contrastText: '#F5F2EA',
    },
    secondary: {
      main: '#C7A24A',
      light: '#DCC07E',
      dark: '#A07E33',
      contrastText: '#221B0E',
    },
    success: {
      main: '#2F6B46',
      light: '#5E8F72',
      dark: '#1F4B30',
      contrastText: '#F5F2EA',
    },
    warning: {
      main: '#B98A2E',
      light: '#D3A95C',
      dark: '#8F6A20',
      contrastText: '#221B0E',
    },
    error: {
      main: '#A5432F',
      light: '#C06B58',
      dark: '#7D3223',
      contrastText: '#F9F4EF',
    },
    info: {
      main: '#4A6B75',
      light: '#74909A',
      dark: '#354E56',
      contrastText: '#F2F5F5',
    },
    background: {
      default: neu.surface,
      paper: neu.surface,
    },
    divider: dark ? '#344238' : '#DAD7CD',
    trust: {
      level1: '#DAD7CD',
      level2: '#A8B5A0',
      level3: '#C7A24A',
      level4: '#2E3D2F',
    },
    text: {
      primary: dark ? '#F3F0E8' : '#1A2E22',
      secondary: dark ? '#B6C0B8' : '#4A5A50',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '2.5rem',
      fontWeight: 900,
      lineHeight: 1.2,
    },
    h2: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h3: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '1.5rem',
      fontWeight: 700,
      lineHeight: 1.4,
    },
    h4: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '1.25rem',
      fontWeight: 700,
      lineHeight: 1.4,
    },
    h5: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontWeight: 700,
    },
    h6: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontWeight: 700,
    },
    body1: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      textTransform: 'none',
      fontWeight: 700,
    },
    overline: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.sm,
          padding: '10px 24px',
          minHeight: 44,
          fontSize: '0.9375rem',
          boxShadow: 'var(--neu-subtle)',
          transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
          '&:hover': { boxShadow: 'var(--neu-raised-hover)', transform: 'translateY(-1px)' },
          '&:active': { boxShadow: 'var(--neu-inset)', transform: 'translateY(1px)' },
          '&:focus-visible': {
            outline: '2px solid #C7A24A',
            outlineOffset: 3,
          },
          '&.Mui-disabled': { boxShadow: 'none', opacity: 0.58 },
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        },
        containedPrimary: {
          boxShadow: 'var(--neu-subtle)',
          '&:hover': {
            backgroundColor: '#1C261D',
          },
        },
        containedSecondary: {
          boxShadow: 'var(--neu-subtle)',
          '&:hover': {
            backgroundColor: '#A07E33',
          },
        },
        outlined: { border: '0 !important', backgroundColor: 'var(--neu-surface)' },
        text: { boxShadow: 'none', '&:hover': { boxShadow: 'var(--neu-subtle)' }, '&:active': { boxShadow: 'var(--neu-inset)' } },
      },
      defaultProps: {
        disableElevation: false,
      },
    },
    MuiCard: {
      defaultProps: {
        variant: 'elevation',
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: SHAPE.card,
          border: '0 !important',
          boxShadow: 'var(--neu-raised) !important',
          backgroundColor: 'var(--neu-surface)',
          backgroundImage: 'none',
          transition: 'box-shadow 180ms ease, transform 180ms ease',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 20,
          '&:last-child': {
            paddingBottom: 20,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          minHeight: 30,
          fontWeight: 600,
          borderRadius: SHAPE.sm,
          border: '0 !important',
          backgroundColor: 'var(--neu-surface)',
          boxShadow: 'var(--neu-subtle) !important',
          '&.MuiChip-clickable:hover': { boxShadow: `${neu.raisedHover} !important` },
          '&.MuiChip-clickable:active': { boxShadow: `${neu.inset} !important` },
          '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          border: '0 !important',
          borderRadius: SHAPE.sm,
          backgroundColor: 'var(--neu-surface)',
          boxShadow: 'var(--neu-subtle) !important',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
          '&:hover': { boxShadow: 'var(--neu-raised-hover) !important', transform: 'translateY(-1px)' },
          '&:active': { boxShadow: 'var(--neu-inset) !important', transform: 'translateY(1px)' },
          '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
          '&.Mui-disabled': { boxShadow: 'none !important', opacity: 0.48 },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: neu.surface } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.sm,
          backgroundColor: 'var(--neu-surface)',
          boxShadow: 'var(--neu-inset)',
          '& .MuiOutlinedInput-notchedOutline': { border: '0 !important' },
          '&.Mui-focused': { boxShadow: `${neu.inset}, 0 0 0 3px rgba(199,162,74,0.18)` },
          '&.Mui-disabled': { boxShadow: 'none', opacity: 0.64 },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: '0 !important', backgroundColor: 'var(--neu-surface)', boxShadow: 'var(--neu-subtle)',
          '&:hover': { backgroundColor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised-hover)' },
          '&.Mui-selected': { backgroundColor: 'var(--neu-surface)', boxShadow: 'var(--neu-inset)' },
          '&.Mui-selected:hover': { backgroundColor: 'var(--neu-surface)' },
        },
      },
    },
    MuiTableCell: { styleOverrides: { root: { borderBottom: '0' }, head: { fontWeight: 700 } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.sm,
          '&.Mui-selected': { backgroundColor: neu.surface, boxShadow: neu.inset },
          '&.Mui-selected:hover': { backgroundColor: neu.surface },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--neu-surface': neu.surface,
          '--neu-raised': neu.raised,
          '--neu-raised-hover': neu.raisedHover,
          '--neu-subtle': neu.subtle,
          '--neu-inset': neu.inset,
        },
        body: { backgroundColor: neu.surface },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.bar,
          height: 8,
        },
      },
    },
  },
  })
}

const ujimoraTheme = createUjimoraTheme('light')

export { ujimoraTheme }
