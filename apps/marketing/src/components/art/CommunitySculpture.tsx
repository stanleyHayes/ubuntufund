import { useState } from 'react'
import type { CSSProperties } from 'react'
import './home-art.css'

export default function CommunitySculpture({ variant = 'unity' }: { variant?: 'unity' | 'seed' }) {
  const [turn, setTurn] = useState(0)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  return (
    <button type="button" className={`community-sculpture community-sculpture--${variant}`}
      aria-label={`Rotate the ${variant === 'unity' ? 'unity links' : 'growing seed'} sculpture`}
      onClick={() => setTurn(value => value + 60)}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          setTurn(value => value + (event.key === 'ArrowRight' ? 20 : -20))
        }
      }}
      onPointerMove={event => {
        if (event.pointerType !== 'mouse') return
        const bounds = event.currentTarget.getBoundingClientRect()
        setTilt({ x: (event.clientX - bounds.left) / bounds.width * 24 - 12, y: (event.clientY - bounds.top) / bounds.height * -20 + 10 })
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
      <span className="sculpture-shadow" />
      <span className="sculpture-stage" style={{ '--turn': `${turn + tilt.x}deg`, '--tilt': `${tilt.y}deg` } as CSSProperties} aria-hidden="true">
        {[0, 1].map(link => <span key={link} className={`sculpture-link sculpture-link--${link}`}>
          {Array.from({ length: 9 }, (_, depth) => <span key={depth} className="sculpture-layer" style={{ transform: `translateZ(${depth * 2}px)` }} />)}
        </span>)}
        <span className="sculpture-seed" />
      </span>
      <span className="sculpture-hint">{variant === 'unity' ? 'Stronger together' : 'Small beginnings. Shared growth.'}<span>Move to explore · tap to turn</span></span>
    </button>
  )
}
