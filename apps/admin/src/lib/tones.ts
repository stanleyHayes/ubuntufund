/**
 * Five-tone accent system for the dark admin console, mirroring the section
 * toning used across the UbuntuFund family (green/gold/clay/maroon/teal).
 * Each tone exposes the same four roles so components can stay tone-agnostic.
 */
export type Tone = 'green' | 'gold' | 'clay' | 'maroon' | 'teal'

export interface ToneColors {
  /** Tone-colored text (eyebrows, icons, emphasis) on dark surfaces. */
  text: string
  /** Solid fill for active states and accents. */
  solid: string
  /** Border / stripe accent. */
  border: string
  /** Soft translucent wash for tinted backgrounds. */
  soft: string
}

export const TONES: Record<Tone, ToneColors> = {
  green: {
    text: '#8FAE96',
    solid: '#8FAE96',
    border: '#5E8F72',
    soft: 'rgba(143, 174, 150, 0.10)',
  },
  gold: {
    text: '#C7A24A',
    solid: '#C7A24A',
    border: '#A07E33',
    soft: 'rgba(199, 162, 74, 0.12)',
  },
  clay: {
    text: '#C06B58',
    solid: '#C06B58',
    border: '#A5432F',
    soft: 'rgba(192, 107, 88, 0.10)',
  },
  maroon: {
    text: '#B98A8A',
    solid: '#7D3223',
    border: '#7D3223',
    soft: 'rgba(125, 50, 35, 0.16)',
  },
  teal: {
    text: '#74909A',
    solid: '#74909A',
    border: '#4A6B75',
    soft: 'rgba(116, 144, 154, 0.10)',
  },
}

/** Hairline used on cards/dividers across the dark console. */
export const HAIRLINE = 'rgba(232, 235, 227, 0.08)'
/** Soft light wash used for tiles and hover states on dark surfaces. */
export const WASH = 'rgba(232, 235, 227, 0.05)'
export const WASH_STRONG = 'rgba(232, 235, 227, 0.09)'
/** Ink used for text sitting on solid sage/gold fills. */
export const ON_FILL = '#0E1916'
