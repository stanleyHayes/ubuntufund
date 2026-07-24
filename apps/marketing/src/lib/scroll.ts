/** Scroll to an in-page section, retrying briefly while it mounts. */
export function scrollToHash(hash: string) {
  const started = Date.now()
  const attempt = () => {
    const el = document.getElementById(hash)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    } else if (Date.now() - started < 1500) {
      requestAnimationFrame(attempt)
    }
  }
  attempt()
}
