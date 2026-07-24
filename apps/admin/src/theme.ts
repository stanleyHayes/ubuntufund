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
      main: '#8FAE96',
      light: '#B5C9BA',
      dark: '#5E8F72',
      contrastText: '#0E1916',
    },
    secondary: {
      main: '#C7A24A',
      light: '#DCC07E',
      dark: '#A07E33',
      contrastText: '#221B0E',
    },
    background: {
      default: '#0E1916',
      paper: '#15241F',
    },
    trust: {
      level1: '#3A4A3E',
      level2: '#8FAE96',
      level3: '#C7A24A',
      level4: '#DCC07E',
    },
    text: {
      primary: '#E8EBE3',
      secondary: '#9FAF9F',
    },
    divider: 'rgba(232, 235, 227, 0.08)',
    error: {
      main: '#C06B58',
    },
    warning: {
      main: '#D3A95C',
    },
    success: {
      main: '#8FAE96',
    },
    info: {
      main: '#74909A',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Outfit", "Inter", sans-serif', fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.2 },
    h2: { fontFamily: '"Outfit", "Inter", sans-serif', fontSize: '2rem', fontWeight: 700, lineHeight: 1.3 },
    h3: { fontFamily: '"Outfit", "Inter", sans-serif', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.4 },
    h4: { fontFamily: '"Outfit", "Inter", sans-serif', fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.4 },
    h5: { fontFamily: '"Outfit", "Inter", sans-serif', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.4 },
    h6: { fontFamily: '"Outfit", "Inter", sans-serif', fontSize: '1rem', fontWeight: 700, lineHeight: 1.4 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { fontFamily: '"Outfit", "Inter", sans-serif', textTransform: 'none', fontWeight: 700 },
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
      defaultProps: {
        variant: 'outlined',
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: SHAPE.card,
          backgroundImage: 'none',
          border: '1px solid rgba(232, 235, 227, 0.07)',
          boxShadow: 'none',
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
