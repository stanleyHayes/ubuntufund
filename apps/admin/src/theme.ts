import { createTheme } from '@mui/material/styles'
import { SHAPE } from '@ubuntu-fund/ui'

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

const adminTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4CAF50',
      light: '#81C784',
      dark: '#2E7D32',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#F9A825',
      light: '#FDD835',
      dark: '#F57F17',
      contrastText: '#212121',
    },
    background: {
      default: '#121218',
      paper: '#1E1E2D',
    },
    trust: {
      level1: '#90CAF9',
      level2: '#42A5F5',
      level3: '#F9A825',
      level4: '#2E7D32',
    },
    text: {
      primary: '#E0E0E8',
      secondary: '#A0A0B0',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    error: {
      main: '#EF5350',
    },
    warning: {
      main: '#FFA726',
    },
    success: {
      main: '#66BB6A',
    },
    info: {
      main: '#42A5F5',
    },
  },
  typography: {
    fontFamily: '"TT Squares", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"TT Squares", "Inter", sans-serif', fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.2 },
    h2: { fontFamily: '"TT Squares", "Inter", sans-serif', fontSize: '2rem', fontWeight: 700, lineHeight: 1.3 },
    h3: { fontFamily: '"TT Squares", "Inter", sans-serif', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.4 },
    h4: { fontFamily: '"TT Squares", "Inter", sans-serif', fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.4 },
    h5: { fontFamily: '"TT Squares", "Inter", sans-serif', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.4 },
    h6: { fontFamily: '"TT Squares", "Inter", sans-serif', fontSize: '1rem', fontWeight: 700, lineHeight: 1.4 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { fontFamily: '"TT Squares", "Inter", sans-serif', textTransform: 'none', fontWeight: 700 },
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
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.card,
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 20,
          '&:last-child': { paddingBottom: 20 },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.06)',
        },
      },
    },
  },
})

export { adminTheme }
