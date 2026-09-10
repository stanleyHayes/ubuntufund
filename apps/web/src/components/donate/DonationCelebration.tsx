import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'

const COLORS = ['#C7A24A', '#DCC07E', '#A8B5A0', '#2F6B46', '#8FAE96']

/** Decorative, finite physics animation. Payment confirmation is owned by the parent. */
export function DonationCelebration() {
  const layer = useRef<HTMLDivElement>(null)
  const badge = useRef<HTMLDivElement>(null)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    const container = layer.current
    const medallion = badge.current
    if (!container || !medallion || typeof medallion.animate !== 'function') return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const animations: Animation[] = []
    const stop = () => {
      animations.forEach(animation => animation.cancel())
      container.replaceChildren()
    }
    const onVisibility = () => { if (document.hidden) stop() }
    const onMotion = () => { if (motion.matches) stop() }
    if (motion.matches || document.hidden) return

    // A damped spring settles naturally, rather than using a repeating bounce.
    const spring = Array.from({ length: 46 }, (_, i) => {
      const t = i / 45
      const displacement = i === 45 ? 0 : Math.exp(-7 * t) * Math.cos(13 * t)
      return { transform: `translateY(${-18 * displacement}px) scale(${1 - 0.12 * displacement})` }
    })
    animations.push(medallion.animate(spring, { duration: 900, easing: 'linear' }))

    const width = window.innerWidth
    const height = window.innerHeight
    const count = width < 600 ? 44 : 68
    // Two fans rise from the card's sides; gravity, drag and flutter bring them down.
    const rect = medallion.getBoundingClientRect()
    const originY = Math.min(height * 0.62, Math.max(180, rect.bottom + 110))
    for (let i = 0; i < count; i += 1) {
      const left = i % 2 === 0
      const particle = document.createElement('span')
      const size = 5 + Math.random() * 6
      const heart = i % 9 === 0
      Object.assign(particle.style, {
        position: 'absolute', left: '0', top: '0',
        width: `${size}px`, height: `${heart ? size : size * 0.6}px`,
        background: COLORS[i % COLORS.length],
        borderRadius: i % 3 === 0 ? '50%' : '1px',
        clipPath: heart ? 'polygon(50% 20%, 70% 0, 100% 10%, 100% 45%, 50% 100%, 0 45%, 0 10%, 30% 0)' : 'none',
      })
      const x0 = width / 2 + (left ? -1 : 1) * Math.min(width * 0.33, 290)
      const vx = (left ? 1 : -1) * (70 + Math.random() * 190)
      const vy = -(310 + Math.random() * 220)
      const spin = (Math.random() - 0.5) * 900
      const phase = Math.random() * Math.PI * 2
      const duration = 3100 + Math.random() * 850
      const frames = Array.from({ length: 65 }, (_, frame) => {
        const progress = frame / 64
        const t = progress * duration / 1000
        const x = x0 + vx * (1 - Math.exp(-0.7 * t)) / 0.7 + Math.sin(t * 5 + phase) * 12 * t
        const y = originY + vy * t + 0.5 * 390 * t * t
        const flutter = 0.45 + Math.abs(Math.cos(t * 7 + phase)) * 0.55
        return {
          transform: `translate3d(${x}px, ${y}px, 0) rotate(${spin * t}deg) scaleX(${flutter})`,
          opacity: frame === 0 ? 0 : Math.min(1, (1 - progress) / 0.28),
        }
      })
      container.appendChild(particle)
      const animation = particle.animate(frames, { duration, delay: Math.random() * 160, fill: 'both', easing: 'linear' })
      animation.onfinish = () => particle.remove()
      animations.push(animation)
    }
    motion.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      motion.removeEventListener('change', onMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [burst])

  return (
    <>
      {typeof document !== 'undefined' && createPortal(<Box ref={layer} data-testid="donation-particles" aria-hidden="true" sx={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1400,
        '@media (prefers-reduced-motion: reduce)': { display: 'none' },
      }} />, document.body)}
      <Box ref={badge} aria-hidden="true" sx={{
        width: 108, height: 108, mx: 'auto', mb: 1.5, borderRadius: '50%',
        display: 'grid', placeItems: 'center', color: 'success.main',
        background: 'linear-gradient(145deg, rgba(168,181,160,.28), rgba(199,162,74,.12))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 12px 32px rgba(46,61,47,.1)',
        border: '1px solid rgba(168,181,160,.3)',
      }}>
        <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Box>
      <Button size="small" variant="text" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => setBurst(value => value + 1)} sx={{
        mb: 2.5, fontSize: '.75rem', color: 'text.secondary',
        '@media (prefers-reduced-motion: reduce)': { display: 'none' },
        '@media (prefers-reduced-motion: no-preference)': { '&:active': { transform: 'scale(.97)' } },
      }}>Celebrate again</Button>
    </>
  )
}
