import type { ThemeSkin } from '@ubuntu-fund/ui'

/**
 * Whether the browser is adopting prerendered HTML rather than drawing a page
 * from nothing.
 *
 * Every route ships as finished HTML (scripts/prerender.ts), so a visitor can
 * already read the page before any JavaScript runs. Entrance animations that
 * start from invisible would hide that text again and replay it, so they skip
 * the page the visitor landed on and run only after in-app navigation.
 *
 * Browser-only state, set by main.tsx before the first render. The server never
 * reads it: it runs no effects, so it never animates.
 */
let hydrating = false

export function beginHydration(): void {
  hydrating = true
}

/** Called once the first render has committed; later pages animate as before. */
export function endHydration(): void {
  hydrating = false
}

export function isHydrating(): boolean {
  return hydrating
}

/** Storage keys of the display preferences a prerendered page cannot know. */
export const COLOR_MODE_KEY = 'uf_color_mode'
export const SKIN_KEY = 'uf_skin'
export const SKINS: readonly ThemeSkin[] = ['neumorphism', 'claymorphism', 'glassmorphism', 'minimal']
/** The look every page is prerendered in. */
export const DEFAULT_LOOK = { darkMode: false, skin: 'neumorphism' } as const satisfies Look

export interface Look {
  darkMode: boolean
  skin: ThemeSkin
}

/** The visitor's saved look; the default when nothing valid is stored or storage is unavailable. */
export function readStoredLook(storage: Pick<Storage, 'getItem'> | undefined = safeLocalStorage()): Look {
  if (!storage) return DEFAULT_LOOK
  try {
    const skin = storage.getItem(SKIN_KEY)
    return {
      darkMode: storage.getItem(COLOR_MODE_KEY) === 'dark',
      skin: skin && (SKINS as string[]).includes(skin) ? (skin as ThemeSkin) : DEFAULT_LOOK.skin,
    }
  } catch {
    return DEFAULT_LOOK
  }
}

/**
 * True when this visitor saved a look other than the one pages are prerendered
 * in. Their first render cannot match the HTML, so main.tsx renders fresh
 * instead of hydrating, and the inline script in index.html (which mirrors this
 * check) keeps the prerendered page hidden until then, so it never flashes the
 * wrong theme.
 */
export function prefersNonDefaultLook(storage?: Pick<Storage, 'getItem'>): boolean {
  const look = readStoredLook(storage ?? safeLocalStorage())
  return look.darkMode !== DEFAULT_LOOK.darkMode || look.skin !== DEFAULT_LOOK.skin
}

/** The attribute the index.html script sets on <html> while that fresh render is pending. */
export const RESTYLE_ATTRIBUTE = 'data-restyle'

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    // Some privacy modes throw on access rather than returning null.
    return undefined
  }
}
