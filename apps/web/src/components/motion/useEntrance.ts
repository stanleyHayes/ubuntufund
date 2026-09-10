import { useEffect, useRef } from 'react'

/** Reveal a surface once when visible. Content stays usable if animation APIs are absent. */
export function useEntrance<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || !window.matchMedia || !('IntersectionObserver' in window) || !node.animate) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return
    let animation: Animation | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        if (preference.matches || node.contains(document.activeElement)) return
        animation = node.animate(
          [
            { opacity: 0.4, translate: '0 12px' },
            { opacity: 1, translate: '0 0' },
          ],
          { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' },
        )
      },
      { threshold: 0.08 },
    )
    const stop = () => {
      observer.disconnect()
      animation?.cancel()
    }
    preference.addEventListener('change', stop)
    node.addEventListener('focusin', stop)
    observer.observe(node)
    return () => {
      stop()
      preference.removeEventListener('change', stop)
      node.removeEventListener('focusin', stop)
    }
  }, [])
  return ref
}
