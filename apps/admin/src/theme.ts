import { alpha, createTheme, type PaletteMode } from '@mui/material/styles'
import { getNeumorphicTokens, getSkinVars, SHAPE, ROUNDED_BUTTON_STYLES, type ThemeSkin } from '@ubuntu-fund/ui'

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

// The admin console shares the web app's user-selectable skin system: every
// surface consumes the shared CSS vars (var(--neu-surface|raised|raised-hover|
// subtle|inset) plus the glass extras --neu-backdrop/--neu-border) rather than
// baking a static shadow in, so switching skin/mode re-skins the console live.
// `mode` only decides the palette and the default (neumorphism) var seed here.
export function makeAdminTheme(mode: PaletteMode, skin: ThemeSkin = 'neumorphism') {
  const dark = mode === 'dark'
  const skinVars = getSkinVars(skin, dark)
  const surface = skin === 'glassmorphism' ? getNeumorphicTokens(dark).surface : skinVars['--neu-surface']

  return createTheme({
    palette: {
      mode,
      primary: dark
        ? { main: '#8FAE96', light: '#B5C9BA', dark: '#5E8F72', contrastText: '#0E1916' }
        : { main: '#2E3D2F', light: '#A8B5A0', dark: '#1C261D', contrastText: '#F5F2EA' },
      secondary: {
        main: '#C7A24A',
        light: '#DCC07E',
        dark: '#A07E33',
        contrastText: '#221B0E',
      },
      background: {
        default: surface,
        paper: skinVars['--neu-surface'],
      },
      trust: dark
        ? { level1: '#3A4A3E', level2: '#8FAE96', level3: '#C7A24A', level4: '#DCC07E' }
        : { level1: '#DAD7CD', level2: '#A8B5A0', level3: '#C7A24A', level4: '#2E3D2F' },
      text: dark
        ? { primary: '#E8EBE3', secondary: '#9FAF9F' }
        : { primary: '#1A2E22', secondary: '#4A5A50' },
      divider: dark ? 'rgba(232, 235, 227, 0.08)' : '#DAD7CD',
      error: {
        main: dark ? '#C06B58' : '#A5432F',
      },
      warning: {
        main: dark ? '#D3A95C' : '#B98A2E',
      },
      success: {
        main: dark ? '#8FAE96' : '#2F6B46',
      },
      info: {
        main: dark ? '#74909A' : '#4A6B75',
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
      MuiAlert: {
        styleOverrides: {
          standard: ({ theme, ownerState }) => ({
            backgroundColor: alpha(theme.palette[ownerState.severity ?? 'info'].main, 0.1),
            color: theme.palette.text.primary,
            '& .MuiAlert-icon': { color: theme.palette[ownerState.severity ?? 'info'].main },
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: SHAPE.sm,
            padding: '8px 24px',
            fontSize: '0.9375rem',
            boxShadow: 'var(--neu-subtle)',
            transition: 'transform 160ms ease, box-shadow 160ms ease',
            '&:hover': { boxShadow: 'var(--neu-raised-hover)', transform: 'translateY(-1px)' },
            '&:active': { boxShadow: 'var(--neu-inset)', transform: 'translateY(1px)' },
            '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 3 },
            '&.Mui-disabled': { boxShadow: 'none', opacity: 0.58 },
          },
          outlined: { border: 'var(--neu-border, 0px solid transparent) !important', backgroundColor: 'var(--neu-surface)' },
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
            backgroundImage: 'none',
            border: 'var(--neu-border, 0px solid transparent)',
            backgroundColor: 'var(--neu-surface)',
            boxShadow: 'var(--neu-raised) !important',
            backdropFilter: 'var(--neu-backdrop, none)',
            WebkitBackdropFilter: 'var(--neu-backdrop, none)',
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
            border: 'var(--neu-border, 0px solid transparent) !important', backgroundColor: 'var(--neu-surface)',
            boxShadow: 'var(--neu-subtle) !important',
            ...(dark ? {
              color: '#E8EBE3',
              '&.MuiChip-colorPrimary': { color: '#B5C9BA' },
              '&.MuiChip-colorSecondary': { color: '#DCC07E' },
              '&.MuiChip-colorSuccess': { color: '#B5C9BA' },
              '&.MuiChip-colorWarning': { color: '#DCC07E' },
              '&.MuiChip-colorError': { color: '#F0A18E' },
              '&.MuiChip-colorInfo': { color: '#A1C5CF' },
            } : {}),
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            border: 'var(--neu-border, 0px solid transparent) !important', borderRadius: SHAPE.sm,
            backgroundColor: 'var(--neu-surface)', boxShadow: 'var(--neu-subtle) !important',
            transition: 'transform 160ms ease, box-shadow 160ms ease',
            '&:hover': { boxShadow: 'var(--neu-raised-hover) !important', transform: 'translateY(-1px)' },
            '&:active': { boxShadow: 'var(--neu-inset) !important', transform: 'translateY(1px)' },
            '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          elevation: { boxShadow: 'var(--neu-raised)' },
          root: {
            borderRadius: SHAPE.card,
            backgroundImage: 'none',
            backgroundColor: 'var(--neu-surface)',
            backdropFilter: 'var(--neu-backdrop, none)',
            WebkitBackdropFilter: 'var(--neu-backdrop, none)',
            border: 'var(--neu-border, 0px solid transparent)',
          },
        },
      },
      MuiFilledInput: { styleOverrides: { root: { borderRadius: `${SHAPE.input} !important` } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: `${SHAPE.input} !important`, backgroundColor: 'var(--neu-surface)', boxShadow: 'var(--neu-inset)',
            '& .MuiOutlinedInput-notchedOutline': { border: 'var(--neu-border, 0px solid transparent) !important' },
            '&.Mui-focused': { boxShadow: 'var(--neu-inset), 0 0 0 3px rgba(199,162,74,0.16)' },
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
          ...ROUNDED_BUTTON_STYLES,
          ':root': {
            ...skinVars,
          },
          body: { backgroundColor: surface, colorScheme: mode },
        },
      },
    },
  })
}
