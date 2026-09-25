/**
 * Home carousel card widths for the current window width. Read from
 * useWindowDimensions (never Dimensions at module load) so iPad rotation,
 * Split View and Stage Manager resize them; the caps keep cards sensible on
 * wide windows.
 */
export function homeCardWidths(windowWidth: number) {
  return { card: Math.min(windowWidth * 0.78, 420), small: Math.min(windowWidth * 0.6, 320) }
}

/** Sizes of the splash screen's decorative rings for the current window width. */
export function splashRingSizes(windowWidth: number) {
  return { inner: windowWidth * 0.7, outer: windowWidth * 0.9 }
}
