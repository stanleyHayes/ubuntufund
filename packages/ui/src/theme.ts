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
  /** Consistent rounded action buttons across all surface finishes. */
  button: '18px',
  /** Form controls stay gently squared across every skin. */
  input: 'var(--shape-input, 6px)',
  /** Cards, chart panels, modals, list containers */
  card: 'var(--shape-card, 4px 16px 4px 16px)',
  /** Chips, badges, icon boxes, small interactive surfaces */
  sm: 'var(--shape-sm, 3px 10px 3px 10px)',
  /** Progress bars, scrollbar thumbs, thin indicators */
  bar: 'var(--shape-bar, 1px 6px 1px 6px)',
} as const

// Explicitly override legacy page-level radii while keeping selection indicators intact.
export const ROUNDED_BUTTON_STYLES = {
  'button, input[type="button"], input[type="submit"], input[type="reset"], .MuiButtonBase-root:not(.MuiCheckbox-root):not(.MuiRadio-root):not(.MuiSwitch-switchBase)': {
    borderRadius: `${SHAPE.button} !important`,
  },
} as const

// Neumorphism only reads when an element shares its background's colour: the
// light "highlight" edge simulates a light source and must stay a soft glow,
// never an opaque white bloom. Keeping the highlight low-opacity means a raised
// light card that overlaps a dark section (dashboard header, hero) no longer
// haloes against it — the effect degrades gracefully instead of glaring.
export function getNeumorphicTokens(dark = false) {
  const surface = dark ? '#172019' : '#F2EFEA'
  const shadow = dark ? 'rgba(0, 0, 0, 0.42)' : 'rgba(72, 62, 43, 0.14)'
  const highlight = dark ? 'rgba(91, 117, 98, 0.14)' : 'rgba(255, 255, 255, 0.55)'

  return {
    surface,
    raised: `6px 6px 14px ${shadow}, -6px -6px 14px ${highlight}`,
    raisedHover: `9px 9px 20px ${shadow}, -8px -8px 18px ${highlight}`,
    subtle: `4px 4px 9px ${shadow}, -4px -4px 9px ${highlight}`,
    inset: `inset 3px 3px 7px ${shadow}, inset -3px -3px 7px ${highlight}`,
  } as const
}

export const NEUMORPHIC_SMOKE_VARS = {
  '--neu-surface': '#F2EFEA',
  '--neu-raised': '6px 6px 14px rgba(72,62,43,0.14), -6px -6px 14px rgba(255,255,255,0.55)',
  '--neu-raised-hover': '9px 9px 20px rgba(72,62,43,0.17), -8px -8px 18px rgba(255,255,255,0.62)',
  '--neu-subtle': '4px 4px 9px rgba(72,62,43,0.12), -4px -4px 9px rgba(255,255,255,0.5)',
  '--neu-inset': 'inset 3px 3px 7px rgba(72,62,43,0.13), inset -3px -3px 7px rgba(255,255,255,0.5)',
} as const

export const NEUMORPHIC_WHITE_VARS = {
  '--neu-surface': '#FFFFFF',
  '--neu-raised': '6px 6px 14px rgba(38,55,44,0.12), -6px -6px 14px rgba(255,255,255,0.5)',
  '--neu-raised-hover': '9px 9px 20px rgba(38,55,44,0.15), -8px -8px 18px rgba(255,255,255,0.55)',
  '--neu-subtle': '4px 4px 9px rgba(38,55,44,0.1), -4px -4px 9px rgba(255,255,255,0.45)',
  '--neu-inset': 'inset 3px 3px 7px rgba(38,55,44,0.11), inset -3px -3px 7px rgba(255,255,255,0.45)',
} as const

// For raised elements that sit on a DARK (forest) section — hero CTAs, dark
// banners. Spread onto the dark container so descendant buttons/cards emboss
// with a near-black shadow + a faint sage highlight instead of the light
// SMOKE highlight, which would bloom into a white halo against the dark ground.
export const NEUMORPHIC_FOREST_VARS = {
  '--neu-surface': '#233126',
  '--neu-raised': 'var(--forest-raised)',
  '--neu-raised-hover': 'var(--forest-raised-hover)',
  '--neu-subtle': 'var(--forest-subtle)',
  '--neu-inset': 'var(--forest-inset)',
} as const

// ---------------------------------------------------------------------------
// Design-system SKINS (user-selectable)
// ---------------------------------------------------------------------------
// A "skin" redefines the shared surface CSS vars that every component already
// consumes (var(--neu-surface|raised|raised-hover|subtle|inset)) plus two glass
// extras (--neu-backdrop, --neu-border). Switching skin = re-applying one var
// set to :root at runtime — no component rewrites. Neumorphism is the default.
export type ThemeSkin = 'neumorphism' | 'claymorphism' | 'glassmorphism' | 'minimal'

export const THEME_SKINS: { id: ThemeSkin; label: string; blurb: string }[] = [
  { id: 'neumorphism', label: 'Neumorphism', blurb: 'Soft, embossed surfaces — the Ujimora default.' },
  { id: 'claymorphism', label: 'Claymorphism', blurb: 'Puffy, playful clay with deep soft shadows.' },
  { id: 'glassmorphism', label: 'Glassmorphism', blurb: 'Frosted, translucent panels with a subtle blur.' },
  { id: 'minimal', label: 'Minimal', blurb: 'Flat, crisp surfaces with hairline borders.' },
]

function getSurfaceVars(skin: ThemeSkin, dark: boolean): Record<string, string> {
  if (skin === 'minimal') {
    const surface = dark ? '#1B211B' : '#FFFFFF'
    const line = dark ? 'rgba(232,235,227,0.12)' : 'rgba(18,24,15,0.1)'
    const sh = dark ? 'rgba(0,0,0,0.35)' : 'rgba(18,24,15,0.06)'
    return {
      // Flat design: definition comes from a hairline border + a whisper shadow.
      '--neu-surface': surface,
      '--neu-raised': `0 1px 2px ${sh}`,
      '--neu-raised-hover': `0 4px 12px ${sh}`,
      '--neu-subtle': `0 1px 1px ${sh}`,
      '--neu-inset': `inset 0 1px 2px ${sh}`,
      '--neu-backdrop': 'none',
      '--neu-border': `1px solid ${line}`,
      '--neu-radius': '12px',
    }
  }
  if (skin === 'claymorphism') {
    const surface = dark ? '#20291F' : '#ECE6DD'
    const sh = dark ? 'rgba(0,0,0,0.55)' : 'rgba(148,130,100,0.42)'
    const hi = dark ? 'rgba(120,150,126,0.14)' : 'rgba(255,255,255,0.9)'
    return {
      '--neu-surface': surface,
      '--neu-raised': `16px 16px 36px ${sh}, -10px -10px 28px ${hi}, inset 2px 2px 6px ${hi}, inset -3px -3px 8px ${sh}`,
      '--neu-raised-hover': `20px 20px 44px ${sh}, -12px -12px 32px ${hi}, inset 2px 2px 6px ${hi}, inset -3px -3px 8px ${sh}`,
      '--neu-subtle': `9px 9px 22px ${sh}, -7px -7px 18px ${hi}, inset 1px 1px 4px ${hi}`,
      '--neu-inset': `inset 6px 6px 14px ${sh}, inset -6px -6px 14px ${hi}`,
      '--neu-backdrop': 'none',
      '--neu-border': '0px solid transparent',
      '--neu-radius': '22px',
    }
  }
  if (skin === 'glassmorphism') {
    const surface = dark ? 'rgba(28,38,29,0.5)' : 'rgba(255,255,255,0.22)'
    return {
      '--neu-surface': surface,
      '--neu-raised': dark ? '0 8px 32px rgba(0,0,0,0.42)' : '0 8px 32px rgba(31,38,28,0.16)',
      '--neu-raised-hover': dark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(31,38,28,0.22)',
      '--neu-subtle': dark ? '0 4px 18px rgba(0,0,0,0.38)' : '0 4px 18px rgba(31,38,28,0.1)',
      '--neu-inset': dark ? 'inset 0 1px 1px rgba(255,255,255,0.06)' : 'inset 0 1px 1px rgba(255,255,255,0.45)',
      '--neu-backdrop': 'blur(14px) saturate(140%)',
      '--neu-border': dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.4)',
      '--neu-radius': '18px',
    }
  }
  // neumorphism (default) — reuse the calibrated dual-shadow tokens
  const neu = getNeumorphicTokens(dark)
  return {
    '--neu-surface': neu.surface,
    '--neu-raised': neu.raised,
    '--neu-raised-hover': neu.raisedHover,
    '--neu-subtle': neu.subtle,
    '--neu-inset': neu.inset,
    '--neu-backdrop': 'none',
    '--neu-border': '0px solid transparent',
    '--neu-radius': '16px',
  }
}

/** Semantic geometry and dark-section shadows follow the same selected skin. */
export function getSkinVars(skin: ThemeSkin, dark: boolean): Record<string, string> {
  const surface = getSurfaceVars(skin, dark)
  const forest = getSurfaceVars(skin, true)
  const rounded = skin !== 'neumorphism'
  return {
    ...surface,
    '--shape-input': '6px',
    '--shape-card': rounded ? surface['--neu-radius'] : '4px 16px 4px 16px',
    '--shape-sm': rounded ? (skin === 'claymorphism' ? '16px' : '10px') : '3px 10px 3px 10px',
    '--shape-bar': rounded ? '999px' : '1px 6px 1px 6px',
    ...Object.fromEntries(['raised', 'raised-hover', 'subtle', 'inset'].map(key => [`--forest-${key}`, forest[`--neu-${key}`]])),
  }
}

/** Apply a skin's CSS vars to :root (inline — overrides the theme defaults). */
export function applySkinVars(skin: ThemeSkin, dark: boolean, el?: HTMLElement): void {
  if (typeof document === 'undefined') return
  const target = el ?? document.documentElement
  const vars = getSkinVars(skin, dark)
  for (const [k, v] of Object.entries(vars)) target.style.setProperty(k, v)
}

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

export function createUjimoraTheme(mode: PaletteMode = 'light', skin: ThemeSkin = 'neumorphism') {
  const dark = mode === 'dark'
  const neu = getNeumorphicTokens(dark)
  const skinVars = getSkinVars(skin, dark)
  const ground = skin === 'glassmorphism' ? neu.surface : skinVars['--neu-surface']
  return createTheme({
  palette: {
    mode,
    // Sage & Neutrals system: deep forest structure, burnished gold action,
    // warm parchment ground. Derived from the brand palette, not framework
    // defaults — semantic states are brand-tinted (clay error, ochre warning).
    primary: {
      main: dark ? '#A8C5AE' : '#2E3D2F',
      light: '#A8B5A0',
      dark: dark ? '#8FAE96' : '#1C261D',
      contrastText: dark ? '#172019' : '#F5F2EA',
    },
    secondary: {
      main: '#C7A24A',
      light: '#DCC07E',
      dark: '#A07E33',
      contrastText: '#221B0E',
    },
    success: {
      main: dark ? '#8DC9A1' : '#2F6B46',
      light: '#5E8F72',
      dark: '#1F4B30',
      contrastText: dark ? '#172019' : '#F5F2EA',
    },
    warning: {
      main: dark ? '#DCC07E' : '#B98A2E',
      light: '#D3A95C',
      dark: '#8F6A20',
      contrastText: '#221B0E',
    },
    error: {
      main: dark ? '#F0A18E' : '#A5432F',
      light: '#C06B58',
      dark: '#7D3223',
      contrastText: dark ? '#172019' : '#F9F4EF',
    },
    info: {
      main: dark ? '#A1C5CF' : '#4A6B75',
      light: '#74909A',
      dark: '#354E56',
      contrastText: dark ? '#172019' : '#F2F5F5',
    },
    background: {
      default: ground,
      paper: skinVars['--neu-surface'],
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
          borderRadius: SHAPE.button,
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
          backgroundColor: '#2E3D2F',
          color: '#F5F2EA',
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
          border: 'var(--neu-border, 0px solid transparent) !important',
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
          border: 'var(--neu-border, 0px solid transparent) !important',
          backgroundColor: 'var(--neu-surface)',
          boxShadow: 'var(--neu-subtle) !important',
          ...(dark ? {
            '&.MuiChip-colorPrimary': { color: '#A8C5AE' },
            '&.MuiChip-colorSuccess': { color: '#8DC9A1' },
            '&.MuiChip-colorError': { color: '#F0A18E' },
            '&.MuiChip-colorWarning': { color: '#DCC07E' },
            '&.MuiChip-colorInfo': { color: '#A1C5CF' },
            '&.MuiChip-colorSecondary': { color: '#DCC07E' },
          } : {
            '&.MuiChip-colorPrimary': { color: '#2E3D2F' },
            '&.MuiChip-colorSuccess': { color: '#2F6B46' },
            '&.MuiChip-colorError': { color: '#A5432F' },
            '&.MuiChip-colorWarning': { color: '#765510' },
            '&.MuiChip-colorInfo': { color: '#355C69' },
            '&.MuiChip-colorSecondary': { color: '#765510' },
          }),
          '&.MuiChip-clickable:hover': { boxShadow: 'var(--neu-raised-hover) !important' },
          '&.MuiChip-clickable:active': { boxShadow: 'var(--neu-inset) !important' },
          '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          border: 'var(--neu-border, 0px solid transparent) !important',
          borderRadius: SHAPE.button,
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
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: 'var(--neu-surface)', borderRadius: SHAPE.card, border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)', WebkitBackdropFilter: 'var(--neu-backdrop)' }, elevation: { boxShadow: 'var(--neu-raised)' } } },
    MuiFilledInput: { styleOverrides: { root: { borderRadius: `${SHAPE.input} !important` } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          // Keep field shape consistent despite older page-level radius overrides.
          borderRadius: `${SHAPE.input} !important`,
          backgroundColor: 'var(--neu-surface)',
          boxShadow: 'var(--neu-inset)',
          '& .MuiOutlinedInput-notchedOutline': { border: 'var(--neu-border, 0px solid transparent) !important' },
          '&.Mui-focused': { boxShadow: 'var(--neu-inset), 0 0 0 3px rgba(199,162,74,0.18)' },
          '&.Mui-disabled': { boxShadow: 'none', opacity: 0.64 },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 'var(--neu-border, 0px solid transparent) !important', backgroundColor: 'var(--neu-surface)', boxShadow: 'var(--neu-subtle)',
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
          '&.Mui-selected': { backgroundColor: 'var(--neu-surface)', boxShadow: 'var(--neu-inset)' },
          '&.Mui-selected:hover': { backgroundColor: 'var(--neu-surface)' },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ...ROUNDED_BUTTON_STYLES,
        ':root': {
          ...skinVars,
          '--text-primary': dark ? '#F3F0E8' : '#1A2E22',
          '--text-secondary': dark ? '#B6C0B8' : '#4A5A50',
          '--text-disabled': dark ? '#7D8B80' : '#858D87',
          '--text-brand': dark ? '#A8C5AE' : '#2E3D2F',
          '--text-success': dark ? '#8DC9A1' : '#2F6B46',
          '--text-warning': dark ? '#DCC07E' : '#8F6A20',
          '--text-error': dark ? '#F0A18E' : '#A5432F',
          '--text-info': dark ? '#A1C5CF' : '#4A6B75',
          '--text-accent': dark ? '#DCB4DE' : '#6A1B9A',
        },
        body: { backgroundColor: ground, colorScheme: mode },
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
