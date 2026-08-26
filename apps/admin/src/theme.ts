import { createTheme } from '@mui/material/styles'
import { getNeumorphicTokens, SHAPE } from '@ubuntu-fund/ui'

const neu = getNeumorphicTokens(true)

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
      default: neu.surface,
      paper: neu.surface,
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
          boxShadow: neu.subtle,
          transition: 'transform 160ms ease, box-shadow 160ms ease',
          '&:hover': { boxShadow: neu.raisedHover, transform: 'translateY(-1px)' },
          '&:active': { boxShadow: neu.inset, transform: 'translateY(1px)' },
          '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 3 },
          '&.Mui-disabled': { boxShadow: 'none', opacity: 0.58 },
        },
        outlined: { border: '0 !important', backgroundColor: neu.surface },
        text: { boxShadow: 'none', '&:hover': { boxShadow: neu.subtle }, '&:active': { boxShadow: neu.inset } },
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
          backgroundImage: 'none',
          border: '0 !important',
          backgroundColor: neu.surface,
          boxShadow: `${neu.raised} !important`,
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
        root: {
          minHeight: 30, fontWeight: 600, borderRadius: SHAPE.sm,
          border: '0 !important', backgroundColor: neu.surface,
          boxShadow: `${neu.subtle} !important`,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          border: '0 !important', borderRadius: SHAPE.sm,
          backgroundColor: neu.surface, boxShadow: `${neu.subtle} !important`,
          transition: 'transform 160ms ease, box-shadow 160ms ease',
          '&:hover': { boxShadow: `${neu.raisedHover} !important`, transform: 'translateY(-1px)' },
          '&:active': { boxShadow: `${neu.inset} !important`, transform: 'translateY(1px)' },
          '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: neu.surface } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: SHAPE.sm, backgroundColor: neu.surface, boxShadow: neu.inset,
          '& .MuiOutlinedInput-notchedOutline': { border: '0 !important' },
          '&.Mui-focused': { boxShadow: `${neu.inset}, 0 0 0 3px rgba(199,162,74,0.16)` },
        },
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
        root: { borderBottom: '0' },
        head: { fontWeight: 700 },
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
  },
})

export { adminTheme }
