import { flushSync } from 'react-dom'

/**
 * Circular-reveal theme switching.
 *
 * The new theme is wiped in as a growing circle centred on whatever the member
 * touched, so the change reads as coming *from* the control they used rather
 * than the page blinking. Built on the View Transitions API: the browser
 * snapshots the page, we swap the theme synchronously, then animate a clip-path
 * on the incoming snapshot.
 *
 * Degrades cleanly. Without View Transitions (Firefox, older Safari) or under
 * `prefers-reduced-motion`, the theme simply applies — no polyfill, no jank,
 * and never a state change that fails to land.
 */

type ViewTransition = { ready: Promise<void>; finished: Promise<void> }
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition
}

/** Matches the theme's own easeOut, so the wipe belongs to the same system. */
const EASING = 'cubic-bezier(.22, 1, .36, 1)'
const DURATION_MS = 480

let lastPointer: { x: number; y: number } | null = null
let tracking = false

/**
 * Remember where the last pointer interaction happened so the reveal can start
 * there. Keyboard input clears it: a stale coordinate from a click minutes ago
 * would send the circle off from an unrelated corner, so we fall back to the
 * focused control instead.
 */
function trackInteractionOrigin(): void {
  if (tracking || typeof window === 'undefined') return
  tracking = true
  window.addEventListener(
    'pointerdown',
    (event) => {
      lastPointer = { x: event.clientX, y: event.clientY }
    },
    { capture: true, passive: true },
  )
  window.addEventListener(
    'keydown',
    () => {
      lastPointer = null
    },
    { capture: true, passive: true },
  )
}

/** Where the circle starts: the pointer, else the focused control, else centre. */
function revealOrigin(): { x: number; y: number } {
  if (lastPointer) return lastPointer
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body) {
    const box = active.getBoundingClientRect()
    if (box.width || box.height) {
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/**
 * Apply a theme change behind a circular reveal.
 *
 * `apply` must perform the React state update. It is run inside `flushSync` so
 * the DOM is already showing the new theme when the browser captures its
 * "after" snapshot — without that, the transition would capture the old theme
 * twice and nothing would appear to change.
 */
export function revealThemeChange(apply: () => void): void {
  trackInteractionOrigin()

  const doc = document as ViewTransitionDocument
  if (typeof doc.startViewTransition !== 'function' || prefersReducedMotion()) {
    apply()
    return
  }

  const { x, y } = revealOrigin()
  // Reach the furthest corner, so the circle always finishes covering the page.
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )

  const transition = doc.startViewTransition(() => {
    flushSync(apply)
  })

  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: DURATION_MS,
          easing: EASING,
          // Clip the incoming theme only; the outgoing one stays put underneath,
          // which is what makes this read as a wipe rather than a cross-fade.
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
    .catch(() => {
      // A transition can be skipped (another starts, or the tab is hidden). The
      // theme has already been applied by then, so there is nothing to undo.
    })
}

/**
 * Neutralises the browser's default cross-fade so only our clip-path runs, and
 * stacks the incoming theme above the outgoing one so the circle reveals it.
 *
 * Spread into a MUI <GlobalStyles> alongside the app's other global styles.
 */
export const themeTransitionStyles = {
  '::view-transition-old(root), ::view-transition-new(root)': {
    animation: 'none',
    mixBlendMode: 'normal',
  },
  '::view-transition-old(root)': { zIndex: 0 },
  '::view-transition-new(root)': { zIndex: 1 },
  // The pair isolates by default, which would blend the two snapshots.
  '::view-transition-image-pair(root)': { isolation: 'none' },
} as const
