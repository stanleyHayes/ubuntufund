import React, { useEffect, useRef, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { SHAPE } from '../theme'

// ─── Keyframes ───────────────────────────────────────────────────────────────

const keyframes = `
  @keyframes weaveShift {
    0% { transform: translateX(0) translateY(0); }
    50% { transform: translateX(-40px) translateY(-20px); }
    100% { transform: translateX(0) translateY(0); }
  }
  @keyframes weaveShiftReverse {
    0% { transform: translateX(0) translateY(0); }
    50% { transform: translateX(40px) translateY(20px); }
    100% { transform: translateX(0) translateY(0); }
  }
  @keyframes glyphOrbit {
    0% { transform: rotate(0deg) translateX(var(--orbit-r)) rotate(0deg); opacity: var(--glyph-opacity); }
    50% { opacity: calc(var(--glyph-opacity) * 1.6); }
    100% { transform: rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg); opacity: var(--glyph-opacity); }
  }
  @keyframes sunPulse {
    0%, 100% { r: 60; opacity: 0.12; }
    50% { r: 75; opacity: 0.2; }
  }
  @keyframes sunRays {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes heatShimmer {
    0%, 100% { transform: translateY(0) scaleY(1); }
    25% { transform: translateY(-1px) scaleY(1.008); }
    75% { transform: translateY(1px) scaleY(0.992); }
  }
  @keyframes drumPulse {
    0%, 100% { transform: scaleX(1); }
    50% { transform: scaleX(1.002); }
  }
  @keyframes fadeInStagger {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes floatDust {
    0% { transform: translate(var(--dx-start), 0) scale(1); opacity: 0.5; }
    100% { transform: translate(var(--dx-end), -60px) scale(0.3); opacity: 0; }
  }
  @keyframes kenteSlide {
    0% { background-position: 0 0; }
    100% { background-position: 80px 0; }
  }
  @keyframes morphPath {
    0%, 100% { d: path("M0,52 Q80,35 160,48 Q240,62 320,45 Q400,30 480,50 Q560,65 640,42 Q720,28 800,48 L800,80 L0,80Z"); }
    33% { d: path("M0,48 Q80,58 160,40 Q240,30 320,55 Q400,65 480,38 Q560,28 640,52 Q720,62 800,42 L800,80 L0,80Z"); }
    66% { d: path("M0,55 Q80,40 160,52 Q240,65 320,38 Q400,28 480,55 Q560,62 640,38 Q720,30 800,52 L800,80 L0,80Z"); }
  }
`

// ─── Kente Weave Pattern (procedurally generated SVG) ────────────────────────

function KenteWeave({ layer = 0 }: { layer?: number }) {
  const colors = [
    ['#2E3D2F', '#C7A24A', '#C75B39', '#5D4037'],
    ['#C7A24A', '#C75B39', '#2E3D2F', '#8D6E63'],
  ][layer]

  // Each "strip" is a band of the weave
  const strips = Array.from({ length: 14 }, (_, i) => ({
    y: i * 8,
    colorIdx: i % 4,
    width: 6 + (i % 3) * 2,
  }))

  // Cross threads
  const crossThreads = Array.from({ length: 20 }, (_, i) => ({
    x: i * 24 + (layer * 12),
    colorIdx: (i + layer) % 4,
  }))

  return (
    <svg
      width="480"
      height="112"
      viewBox="0 0 480 112"
      style={{
        position: 'absolute',
        left: layer === 0 ? '-5%' : '50%',
        top: layer === 0 ? '10%' : '55%',
        opacity: 0.07 + layer * 0.02,
        animation: `${layer === 0 ? 'weaveShift' : 'weaveShiftReverse'} ${18 + layer * 4}s ease-in-out infinite`,
        pointerEvents: 'none',
      }}
      preserveAspectRatio="none"
    >
      {/* Horizontal strips */}
      {strips.map((s, i) => (
        <rect key={`h-${i}`} x="0" y={s.y} width="480" height={s.width} fill={colors[s.colorIdx]} rx="1" />
      ))}
      {/* Vertical cross-threads with over-under illusion */}
      {crossThreads.map((ct, i) => (
        <g key={`v-${i}`}>
          {Array.from({ length: 7 }, (_, j) => (
            <rect
              key={j}
              x={ct.x}
              y={j * 16}
              width="8"
              height="12"
              fill={colors[ct.colorIdx]}
              rx="1"
              opacity={j % 2 === 0 ? 0.9 : 0.5}
            />
          ))}
        </g>
      ))}
    </svg>
  )
}

// ─── Adinkra Orbiting Glyphs ─────────────────────────────────────────────────

const ADINKRA_PATHS = [
  // Gye Nyame (Supremacy of God)
  'M12 2C7 2 3 6 3 11c0 3 2 5 4 7-1 1-3 3-3 5 0 2 2 3 4 2 2-1 3-3 5-5 2 2 3 4 5 5 2 1 4 0 4-2 0-2-2-4-3-5 2-2 4-4 4-7 0-5-4-9-9-9z',
  // Sankofa (learn from the past)
  'M16 5c3-2 6 0 6 3s-3 5-6 3l-2 3c-1 4-4 7-7 9-2 1-3 0-3-2s2-4 5-6l3-5c-2-3-1-6 4-8z',
  // Dwennimmen (strength with humility)
  'M12 3c-3-2-6-1-7 2s0 6 3 7c-3 1-5 4-4 7s4 4 7 3c-1 3 1 6 4 7s6 0 7-3c3 1 6-1 7-4s0-6-3-7c3-1 5-4 4-7s-4-4-7-3c1-3-1-6-4-7s-6 0-7 3z',
  // Funtunfunefu (unity)
  'M5 12a7 7 0 0114 0M19 12a7 7 0 01-14 0',
  // Nkyinkyim (initiative / versatility)
  'M3 4l4 4-4 4 4 4-4 4M21 4l-4 4 4 4-4 4 4 4',
]

function OrbitingGlyphs() {
  const glyphs = ADINKRA_PATHS.map((path, i) => ({
    path,
    orbitR: 80 + i * 35,
    duration: 30 + i * 8,
    delay: i * -6,
    size: 22 + (i % 3) * 4,
    opacity: 0.12 + (i % 3) * 0.04,
    color: ['#2E3D2F', '#C7A24A', '#C75B39', '#5D4037', '#8D6E63'][i],
  }))

  return (
    <Box
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }}
    >
      {glyphs.map((g, i) => (
        <svg
          key={i}
          width={g.size}
          height={g.size}
          viewBox="0 0 24 24"
          fill="none"
          style={{
            position: 'absolute',
            top: -g.size / 2,
            left: -g.size / 2,
            ['--orbit-r' as string]: `${g.orbitR}px`,
            ['--glyph-opacity' as string]: g.opacity,
            animation: `glyphOrbit ${g.duration}s linear ${g.delay}s infinite`,
          }}
        >
          <path d={g.path} stroke={g.color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      ))}
    </Box>
  )
}

// ─── African Sun ─────────────────────────────────────────────────────────────

function AfricanSun() {
  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      style={{
        position: 'absolute',
        top: '-30%',
        right: '8%',
        opacity: 0.15,
        pointerEvents: 'none',
      }}
    >
      {/* Core */}
      <circle cx="100" cy="100" r="30" fill="#C7A24A" opacity="0.5" />
      {/* Pulsing halo */}
      <circle cx="100" cy="100" fill="none" stroke="#C7A24A" strokeWidth="1" style={{ animation: 'sunPulse 4s ease infinite' }}>
        <animate attributeName="r" values="60;75;60" dur="4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.12;0.2;0.12" dur="4s" repeatCount="indefinite" />
      </circle>
      {/* Rotating rays */}
      <g style={{ transformOrigin: '100px 100px', animation: 'sunRays 40s linear infinite' }}>
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180
          const x1 = 100 + 40 * Math.cos(angle)
          const y1 = 100 + 40 * Math.sin(angle)
          const x2 = 100 + 90 * Math.cos(angle)
          const y2 = 100 + 90 * Math.sin(angle)
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#C7A24A"
              strokeWidth={i % 2 === 0 ? '1.5' : '0.8'}
              opacity={i % 2 === 0 ? 0.3 : 0.15}
              strokeLinecap="round"
            />
          )
        })}
      </g>
    </svg>
  )
}

// ─── Morphing Terrain ────────────────────────────────────────────────────────

function MorphingTerrain() {
  return (
    <svg
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '45%',
        pointerEvents: 'none',
      }}
      viewBox="0 0 800 80"
      preserveAspectRatio="none"
    >
      {/* Far hills - morphing */}
      <path
        fill="rgba(93,64,55,0.08)"
        style={{ animation: 'morphPath 20s ease-in-out infinite' }}
      >
        <animate
          attributeName="d"
          values="
            M0,52 Q80,35 160,48 Q240,62 320,45 Q400,30 480,50 Q560,65 640,42 Q720,28 800,48 L800,80 L0,80Z;
            M0,48 Q80,58 160,40 Q240,30 320,55 Q400,65 480,38 Q560,28 640,52 Q720,62 800,42 L800,80 L0,80Z;
            M0,55 Q80,40 160,52 Q240,65 320,38 Q400,28 480,55 Q560,62 640,38 Q720,30 800,52 L800,80 L0,80Z;
            M0,52 Q80,35 160,48 Q240,62 320,45 Q400,30 480,50 Q560,65 640,42 Q720,28 800,48 L800,80 L0,80Z
          "
          dur="20s"
          repeatCount="indefinite"
        />
      </path>
      {/* Near terrain */}
      <path
        fill="rgba(46, 61, 47,0.06)"
      >
        <animate
          attributeName="d"
          values="
            M0,62 Q100,52 200,60 Q300,72 400,58 Q500,48 600,62 Q700,72 800,56 L800,80 L0,80Z;
            M0,58 Q100,68 200,55 Q300,45 400,62 Q500,72 600,55 Q700,48 800,62 L800,80 L0,80Z;
            M0,65 Q100,55 200,65 Q300,72 400,52 Q500,45 600,65 Q700,72 800,55 L800,80 L0,80Z;
            M0,62 Q100,52 200,60 Q300,72 400,58 Q500,48 600,62 Q700,72 800,56 L800,80 L0,80Z
          "
          dur="16s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  )
}

// ─── Heat Shimmer Dust ───────────────────────────────────────────────────────

function DustMotes() {
  const motes = [
    { x: '10%', dxS: '-5px', dxE: '8px', delay: 0, dur: 4, color: '#C7A24A', size: 3 },
    { x: '25%', dxS: '3px', dxE: '-6px', delay: 0.8, dur: 5, color: '#C75B39', size: 4 },
    { x: '45%', dxS: '-8px', dxE: '4px', delay: 1.5, dur: 3.5, color: '#2E3D2F', size: 3 },
    { x: '60%', dxS: '6px', dxE: '-3px', delay: 0.3, dur: 4.5, color: '#5D4037', size: 3 },
    { x: '78%', dxS: '-4px', dxE: '7px', delay: 2, dur: 4, color: '#C7A24A', size: 4 },
    { x: '90%', dxS: '5px', dxE: '-5px', delay: 1, dur: 3.8, color: '#C75B39', size: 3 },
  ]

  return (
    <>
      {motes.map((m, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            bottom: '15%',
            left: m.x,
            width: m.size,
            height: m.size,
            borderRadius: '50%',
            backgroundColor: m.color,
            ['--dx-start' as string]: m.dxS,
            ['--dx-end' as string]: m.dxE,
            animation: `floatDust ${m.dur}s ease ${m.delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  )
}

// ─── Interactive Mouse Parallax Hook ─────────────────────────────────────────

function useMouseParallax(ref: React.RefObject<HTMLDivElement | null>) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      setOffset({
        x: (e.clientX - cx) / rect.width,
        y: (e.clientY - cy) / rect.height,
      })
    },
    [ref]
  )

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  return offset
}

// ─── Main Banner Component ───────────────────────────────────────────────────

export interface AfricanBannerProps {
  title: string
  subtitle?: string
  /** Longer description shown below the subtitle */
  description?: string
  /** Accent text highlighted in gold */
  accentWord?: string
  /** React node (e.g. MUI icon) rendered above the title inside a frosted-glass pill */
  icon?: React.ReactNode
  /** Compact mode for inner pages (shorter height) */
  compact?: boolean
  /** Add top padding to clear a fixed/sticky navbar (px value, e.g. 64) */
  navbarOffset?: number
}

export function AfricanBanner({ title, subtitle, description, accentWord, icon, compact = false, navbarOffset }: AfricanBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const parallax = useMouseParallax(containerRef)

  // Split title to highlight accent word
  let titleParts: { text: string; accent: boolean }[] = [{ text: title, accent: false }]
  if (accentWord && title.includes(accentWord)) {
    const idx = title.indexOf(accentWord)
    titleParts = [
      { text: title.slice(0, idx), accent: false },
      { text: accentWord, accent: true },
      { text: title.slice(idx + accentWord.length), accent: false },
    ].filter((p) => p.text)
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: compact ? { xs: 200, md: 240 } : { xs: 280, md: 340 },
        pt: navbarOffset ? `${navbarOffset}px` : 0,
        overflow: 'hidden',
        backgroundColor: '#2E3D2F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'drumPulse 4s ease infinite',
      }}
    >
      <style>{keyframes}</style>

      {/* === Layer 0: Kente weave background === */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${parallax.x * -8}px, ${parallax.y * -5}px)`,
          transition: 'transform 0.3s ease-out',
        }}
      >
        <KenteWeave layer={0} />
        <KenteWeave layer={1} />
      </Box>

      {/* === Layer 1: Morphing terrain === */}
      <MorphingTerrain />

      {/* === Layer 2: African sun === */}
      {(
        <Box
          sx={{
            transform: `translate(${parallax.x * 15}px, ${parallax.y * 10}px)`,
            transition: 'transform 0.4s ease-out',
          }}
        >
          <AfricanSun />
        </Box>
      )}

      {/* === Layer 3: Orbiting Adinkra === */}
      <Box
        sx={{
          transform: `translate(${parallax.x * 12}px, ${parallax.y * 8}px)`,
          transition: 'transform 0.35s ease-out',
        }}
      >
        <OrbitingGlyphs />
      </Box>

      {/* === Layer 4: Dust motes === */}
      <DustMotes />

      {/* === Layer 5: Heat shimmer overlay === */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
          animation: 'heatShimmer 3s ease infinite',
          pointerEvents: 'none',
        }}
      />

      {/* === Content === */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          px: 3,
          py: compact ? { xs: 4, md: 5 } : { xs: 5, md: 7 },
          transform: `translate(${parallax.x * -4}px, ${parallax.y * -3}px)`,
          transition: 'transform 0.2s ease-out',
        }}
      >
        {/* Icon */}
        {icon && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: compact ? 56 : 72,
              height: compact ? 56 : 72,
              borderRadius: SHAPE.card,
              bgcolor: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(16px)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              mb: 2.5,
              animation: 'fadeInStagger 0.5s ease forwards',
              color: '#C7A24A',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
              '& .MuiSvgIcon-root': {
                fontSize: compact ? '1.8rem' : '2.2rem',
              },
            }}
          >
            {icon}
          </Box>
        )}

        <Typography
          variant={compact ? 'h4' : 'h2'}
          sx={{
            fontWeight: 900,
            color: '#fff',
            textShadow: '0 2px 20px rgba(0,0,0,0.3)',
            lineHeight: 1.2,
            opacity: 0,
            animation: `fadeInStagger 0.6s ease ${icon ? '0.08s' : '0s'} forwards`,
            mb: subtitle || description ? 1 : 0,
          }}
        >
          {titleParts.map((part, i) =>
            part.accent ? (
              <Box
                key={i}
                component="span"
                sx={{
                  color: '#C7A24A',
                  filter: 'drop-shadow(0 2px 8px rgba(199, 162, 74,0.4))',
                }}
              >
                {part.text}
              </Box>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </Typography>

        {subtitle && (
          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: compact ? '0.9rem' : '1.05rem',
              fontWeight: 500,
              maxWidth: 540,
              mx: 'auto',
              lineHeight: 1.6,
              opacity: 0,
              animation: `fadeInStagger 0.6s ease ${icon ? '0.16s' : '0.15s'} forwards`,
              mb: description ? 0.75 : 0,
            }}
          >
            {subtitle}
          </Typography>
        )}

        {description && (
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: compact ? '0.8rem' : '0.88rem',
              maxWidth: 480,
              mx: 'auto',
              lineHeight: 1.7,
              opacity: 0,
              animation: `fadeInStagger 0.6s ease ${icon ? '0.24s' : '0.25s'} forwards`,
            }}
          >
            {description}
          </Typography>
        )}
      </Box>

      {/* === Bottom wave transition === */}
      <svg
        style={{
          position: 'absolute',
          bottom: -1,
          left: 0,
          width: '100%',
          height: compact ? 24 : 36,
          display: 'block',
        }}
        viewBox="0 0 1440 36"
        preserveAspectRatio="none"
      >
        {/* Subtle Kente-colored accent line along the wave */}
        <path
          d="M0,8 C120,20 240,2 360,12 C480,22 600,4 720,14 C840,24 960,6 1080,14 C1200,22 1320,4 1440,10"
          fill="none"
          stroke="rgba(199, 162, 74,0.25)"
          strokeWidth="1.5"
        />
        {/* Main wave fill matching page background */}
        <path
          d="M0,16 C180,30 360,6 540,18 C720,30 900,8 1080,18 C1260,28 1380,12 1440,16 L1440,36 L0,36Z"
          fill="#F2EFEA"
        />
      </svg>
    </Box>
  )
}
