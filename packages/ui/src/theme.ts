import { createTheme } from '@mui/material/styles'

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
// echoes the angular TT Squares typeface used across the platform.
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
`

const ubuntuFundTheme = createTheme({
  palette: {
    primary: {
      main: '#2E7D32',
      light: '#4CAF50',
      dark: '#1B5E20',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#F9A825',
      light: '#FDD835',
      dark: '#F57F17',
      contrastText: '#212121',
    },
    background: {
      default: '#FAFAF5',
      paper: '#FFFFFF',
    },
    trust: {
      level1: '#90CAF9',
      level2: '#42A5F5',
      level3: '#F9A825',
      level4: '#2E7D32',
    },
    text: {
      primary: '#212121',
      secondary: '#616161',
    },
  },
  typography: {
    fontFamily: '"TT Squares", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"TT Squares", "Inter", sans-serif',
      fontSize: '2.5rem',
      fontWeight: 900,
      lineHeight: 1.2,
    },
    h2: {
      fontFamily: '"TT Squares", "Inter", sans-serif',
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h3: {
      fontFamily: '"TT Squares", "Inter", sans-serif',
      fontSize: '1.5rem',
      fontWeight: 700,
      lineHeight: 1.4,
    },
    h4: {
      fontFamily: '"TT Squares", "Inter", sans-serif',
      fontSize: '1.25rem',
      fontWeight: 700,
      lineHeight: 1.4,
    },
    h5: {
      fontFamily: '"TT Squares", "Inter", sans-serif',
      fontWeight: 700,
    },
    h6: {
      fontFamily: '"TT Squares", "Inter", sans-serif',
      fontWeight: 700,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontFamily: '"TT Squares", "Inter", sans-serif',
      textTransform: 'none',
      fontWeight: 700,
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
          padding: '8px 24px',
          fontSize: '0.9375rem',
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: '#1B5E20',
          },
        },
        containedSecondary: {
          '&:hover': {
            backgroundColor: '#F57F17',
          },
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.card,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
          },
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
          fontWeight: 500,
          borderRadius: SHAPE.sm,
        },
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

export { ubuntuFundTheme }
