/**
 * The one place the product honours `prefers-reduced-motion`.
 *
 * Motion is authored inline throughout both apps — 145 `animation:` rules
 * across 32 files, written as `sx` props and Emotion keyframes — and none of
 * them ask whether the visitor wants motion. The MUI theme already shortens
 * its own transition durations when the preference is set, but a theme
 * duration has no reach into an `sx` keyframe, so cards still slid, banners
 * still shimmered and skeletons still pulsed for someone who had explicitly
 * asked them not to. That is WCAG 2.3.3, and for a vestibular disorder it is
 * not a cosmetic complaint.
 *
 * Gating 145 sites individually would mean touching 32 files and would rot the
 * first time someone adds the 146th. This is the standard reset instead: one
 * rule, applied only inside the media query, so a visitor who has not set the
 * preference sees byte-for-byte what they saw before.
 *
 * Near-zero rather than `animation: none`, which matters: many of these
 * animations use `both` fill-mode and begin at `opacity: 0`. Removing the
 * animation outright leaves the element stuck at that starting frame —
 * invisible content. A 0.01ms duration runs the animation to completion
 * immediately, landing on the final frame, and still fires `animationend` for
 * anything listening.
 */
export const reducedMotionStyles = {
  '@media (prefers-reduced-motion: reduce)': {
    '*, *::before, *::after': {
      animationDuration: '0.01ms !important',
      animationIterationCount: '1 !important',
      animationDelay: '0ms !important',
      transitionDuration: '0.01ms !important',
      transitionDelay: '0ms !important',
      scrollBehavior: 'auto !important',
    },
  },
} as const
