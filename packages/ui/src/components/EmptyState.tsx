import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { keyframes } from '@mui/material/styles'

// ---------------------------------------------------------------------------
// MUI keyframes (for Box sx usage)
// ---------------------------------------------------------------------------

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
`

// ---------------------------------------------------------------------------
// Illustration variants — pure SVG with embedded <style> for animations
// ---------------------------------------------------------------------------

type IllustrationVariant = 'empty' | 'search' | 'error' | 'notFound' | 'noData'

/** Unique prefix per render to avoid CSS collisions */
let _counter = 0
function useId() {
  const [id] = React.useState(() => `es-${++_counter}`)
  return id
}

function SearchIllustration() {
  const id = useId()
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes ${id}-draw { to { stroke-dashoffset: 0 } }
        @keyframes ${id}-pop  { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes ${id}-sway { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        .${id}-d1 { stroke-dashoffset: 200; animation: ${id}-draw 1s .2s ease forwards }
        .${id}-d2 { stroke-dashoffset: 50; animation: ${id}-draw .5s 1s ease forwards }
        .${id}-d3 { stroke-dashoffset: 40; animation: ${id}-draw .5s 1.2s ease forwards }
        .${id}-pop { transform: scale(0); opacity: 0; animation: ${id}-pop .4s 1.4s ease forwards }
        .${id}-dot { transform: scale(0); opacity: 0 }
        .${id}-dot1 { animation: ${id}-pop .3s .8s ease forwards }
        .${id}-dot2 { animation: ${id}-pop .3s 1.0s ease forwards }
        .${id}-dot3 { animation: ${id}-pop .3s 1.2s ease forwards }
        .${id}-sway { transform-origin: 90px 90px; animation: ${id}-sway 3s 1.5s ease-in-out infinite }
      `}</style>
      {/* Decorative ring */}
      <circle cx="90" cy="90" r="80" stroke="#E9EFE6" strokeWidth="1.5" strokeDasharray="6 8" opacity=".5" />
      {/* Magnifying glass circle */}
      <circle cx="76" cy="76" r="38" stroke="#5E8F72" strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray="200" className={`${id}-d1`} />
      {/* Glass fill */}
      <circle cx="76" cy="76" r="34" fill="#E9EFE6" opacity=".4" className={`${id}-pop`} />
      {/* Handle */}
      <path d="M104 104 L135 135" stroke="#8D6E63" strokeWidth="5" strokeLinecap="round"
        strokeDasharray="50" className={`${id}-d2`} />
      {/* Handle knob */}
      <circle cx="138" cy="138" r="5" fill="#8D6E63" className={`${id}-pop`} />
      {/* Question mark */}
      <g className={`${id}-sway`}>
        <path d="M67 64 C67 55 76 51 82 55 C88 59 85 67 76 70 L76 76"
          stroke="#C7A24A" strokeWidth="3" strokeLinecap="round" fill="none"
          strokeDasharray="40" className={`${id}-d3`} />
        <circle cx="76" cy="83" r="2.5" fill="#C7A24A" className={`${id}-pop`} />
      </g>
      {/* Floating accent dots */}
      <circle cx="30" cy="40" r="4" fill="#5E8F72" className={`${id}-dot ${id}-dot1`} />
      <circle cx="145" cy="35" r="3" fill="#C7A24A" className={`${id}-dot ${id}-dot2`} />
      <circle cx="150" cy="95" r="3.5" fill="#66BB6A" className={`${id}-dot ${id}-dot3`} />
      {/* Sparkles */}
      <g className={`${id}-pop`}>
        <line x1="35" y1="130" x2="35" y2="140" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="30" y1="135" x2="40" y2="135" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function ErrorIllustration() {
  const id = useId()
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes ${id}-draw { to { stroke-dashoffset: 0 } }
        @keyframes ${id}-pop  { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes ${id}-pulse { 0%,100% { opacity: .6 } 50% { opacity: 1 } }
        @keyframes ${id}-wobble { 0%,100% { transform: rotate(0deg) } 25% { transform: rotate(-2deg) } 75% { transform: rotate(2deg) } }
        .${id}-tri { stroke-dashoffset: 300; animation: ${id}-draw 1.2s .2s ease forwards }
        .${id}-ex1 { stroke-dashoffset: 30; animation: ${id}-draw .4s 1s ease forwards }
        .${id}-dot { transform: scale(0); opacity: 0; animation: ${id}-pop .3s 1.3s ease forwards }
        .${id}-gear { transform-origin: 140px 140px; animation: ${id}-wobble 2s 1.5s ease-in-out infinite }
        .${id}-glow { animation: ${id}-pulse 2s 1s ease-in-out infinite }
        .${id}-sp { transform: scale(0); opacity: 0 }
        .${id}-sp1 { animation: ${id}-pop .3s 1.4s ease forwards }
        .${id}-sp2 { animation: ${id}-pop .3s 1.6s ease forwards }
      `}</style>
      {/* Soft glow behind triangle */}
      <circle cx="90" cy="80" r="55" fill="#FFF8E1" className={`${id}-glow`} />
      {/* Warning triangle */}
      <path d="M90 25 L155 130 L25 130 Z"
        stroke="#C7A24A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        strokeDasharray="300" className={`${id}-tri`} />
      {/* Triangle fill */}
      <path d="M90 35 L148 125 L32 125 Z" fill="#FFF8E1" opacity=".5" className={`${id}-dot`} />
      {/* Exclamation line */}
      <path d="M90 62 L90 92" stroke="#EF5350" strokeWidth="4" strokeLinecap="round"
        strokeDasharray="30" className={`${id}-ex1`} />
      {/* Exclamation dot */}
      <circle cx="90" cy="105" r="3" fill="#EF5350" className={`${id}-dot`} />
      {/* Repair gear */}
      <g className={`${id}-gear`}>
        <circle cx="140" cy="140" r="14" stroke="#5E8F72" strokeWidth="2.5" fill="none"
          strokeDasharray="90" strokeDashoffset="90"
          style={{ animation: `${id}-draw 0.8s 1.2s ease forwards` }} />
        <circle cx="140" cy="140" r="5" fill="#5E8F72" className={`${id}-dot`} />
        {/* Gear teeth */}
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = (deg * Math.PI) / 180
          const x1 = 140 + Math.cos(rad) * 12
          const y1 = 140 + Math.sin(rad) * 12
          const x2 = 140 + Math.cos(rad) * 17
          const y2 = 140 + Math.sin(rad) * 17
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5E8F72" strokeWidth="2.5" strokeLinecap="round" className={`${id}-dot`} />
        })}
      </g>
      {/* Sparkles */}
      <g className={`${id}-sp ${id}-sp1`}>
        <line x1="40" y1="45" x2="40" y2="55" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="35" y1="50" x2="45" y2="50" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className={`${id}-sp ${id}-sp2`}>
        <line x1="148" y1="38" x2="148" y2="46" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="144" y1="42" x2="152" y2="42" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function NotFoundIllustration() {
  const id = useId()
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes ${id}-draw { to { stroke-dashoffset: 0 } }
        @keyframes ${id}-pop  { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes ${id}-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes ${id}-sway { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        .${id}-ring { stroke-dashoffset: 250; animation: ${id}-draw 1.2s .2s ease forwards }
        .${id}-needle { stroke-dashoffset: 40; animation: ${id}-draw .5s 1s ease forwards }
        .${id}-dot { transform: scale(0); opacity: 0; animation: ${id}-pop .3s 1.3s ease forwards }
        .${id}-trail { stroke-dashoffset: 200; animation: ${id}-draw 1.5s 1.4s ease forwards }
        .${id}-flag { transform-origin: 145px 42px; animation: ${id}-sway 2.5s 1.8s ease-in-out infinite }
        .${id}-flagpop { transform: scale(0); opacity: 0; animation: ${id}-pop .4s 1.6s ease forwards }
      `}</style>
      {/* Outer decorative ring */}
      <circle cx="80" cy="80" r="55" stroke="#E9EFE6" strokeWidth="1.5" strokeDasharray="6 8" opacity=".4" />
      {/* Compass ring */}
      <circle cx="80" cy="80" r="45" stroke="#5E8F72" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="250" className={`${id}-ring`} />
      {/* Compass fill */}
      <circle cx="80" cy="80" r="41" fill="#E9EFE6" opacity=".3" className={`${id}-dot`} />
      {/* Cardinal marks */}
      {[
        { x: 80, y: 40, label: 'N' }, { x: 80, y: 124, label: 'S' },
        { x: 40, y: 82, label: 'W' }, { x: 120, y: 82, label: 'E' },
      ].map((m) => (
        <text key={m.label} x={m.x} y={m.y} textAnchor="middle" fill="#8D6E63"
          fontSize="10" fontWeight="700" className={`${id}-dot`}>{m.label}</text>
      ))}
      {/* Needle N */}
      <path d="M80 80 L72 45" stroke="#EF5350" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="40" className={`${id}-needle`} />
      {/* Needle S */}
      <path d="M80 80 L88 115" stroke="#8D6E63" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="40" className={`${id}-needle`} />
      {/* Center dot */}
      <circle cx="80" cy="80" r="4" fill="#C7A24A" className={`${id}-dot`} />
      {/* Wandering trail */}
      <path d="M20 155 C40 148 55 160 75 150 C95 140 110 155 135 145 C148 140 155 148 165 143"
        stroke="#C7A24A" strokeWidth="2.5" strokeLinecap="round" fill="none"
        strokeDasharray="4 7"
        strokeDashoffset="200" className={`${id}-trail`} />
      {/* Destination flag */}
      <g className={`${id}-flag ${id}-flagpop`}>
        <line x1="145" y1="42" x2="145" y2="22" stroke="#5E8F72" strokeWidth="2" strokeLinecap="round" />
        <path d="M145 22 L160 28 L145 34 Z" fill="#5E8F72" />
      </g>
    </svg>
  )
}

function NoDataIllustration() {
  const id = useId()
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes ${id}-draw { to { stroke-dashoffset: 0 } }
        @keyframes ${id}-pop  { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes ${id}-sway { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        .${id}-doc { stroke-dashoffset: 350; animation: ${id}-draw 1.2s .2s ease forwards }
        .${id}-line { stroke-dashoffset: 60 }
        .${id}-l1 { animation: ${id}-draw .4s .9s ease forwards }
        .${id}-l2 { animation: ${id}-draw .4s 1.1s ease forwards }
        .${id}-l3 { animation: ${id}-draw .4s 1.3s ease forwards }
        .${id}-l4 { animation: ${id}-draw .3s 1.5s ease forwards }
        .${id}-dot { transform: scale(0); opacity: 0; animation: ${id}-pop .4s 1.4s ease forwards }
        .${id}-leaf { transform-origin: 130px 120px; animation: ${id}-sway 3s 2s ease-in-out infinite }
        .${id}-leafpop { transform: scale(0); opacity: 0; animation: ${id}-pop .4s 1.7s ease forwards }
      `}</style>
      {/* Shadow */}
      <ellipse cx="85" cy="160" rx="50" ry="6" fill="#E9EFE6" opacity=".5" className={`${id}-dot`} />
      {/* Document */}
      <rect x="40" y="20" width="80" height="110" rx="8"
        stroke="#5E8F72" strokeWidth="3" fill="none"
        strokeDasharray="350" className={`${id}-doc`} />
      {/* Document fill */}
      <rect x="44" y="24" width="72" height="102" rx="6" fill="#F1F8E9" opacity=".5" className={`${id}-dot`} />
      {/* Fold corner */}
      <path d="M100 20 L120 20 L120 40" fill="none" stroke="#5E8F72" strokeWidth="2"
        strokeDasharray="40" strokeDashoffset="40"
        style={{ animation: `${id}-draw .3s 1s ease forwards` }} />
      <path d="M100 20 L120 40" fill="none" stroke="#5E8F72" strokeWidth="2" strokeDasharray="3 3" className={`${id}-dot`} />
      {/* Content lines */}
      <line x1="56" y1="52" x2="104" y2="52" stroke="#A8B5A0" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="60" className={`${id}-line ${id}-l1`} />
      <line x1="56" y1="68" x2="96" y2="68" stroke="#C8E6C9" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="60" className={`${id}-line ${id}-l2`} />
      <line x1="56" y1="84" x2="88" y2="84" stroke="#A8B5A0" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="60" className={`${id}-line ${id}-l3`} />
      <line x1="56" y1="100" x2="76" y2="100" stroke="#C8E6C9" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="60" className={`${id}-line ${id}-l4`} />
      {/* Sprouting plant */}
      <g className={`${id}-leaf ${id}-leafpop`}>
        <path d="M130 120 C130 100 130 85 130 75" stroke="#66BB6A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="118" cy="90" rx="10" ry="5" fill="#5E8F72" opacity=".7" transform="rotate(-30, 118, 90)" />
        <ellipse cx="142" cy="80" rx="10" ry="5" fill="#66BB6A" opacity=".7" transform="rotate(30, 142, 80)" />
        <circle cx="130" cy="70" r="6" fill="#C7A24A" opacity=".8" />
      </g>
      {/* Sparkles */}
      <g className={`${id}-dot`}>
        <line x1="148" y1="55" x2="148" y2="65" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="143" y1="60" x2="153" y2="60" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function EmptyIllustration() {
  const id = useId()
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes ${id}-draw { to { stroke-dashoffset: 0 } }
        @keyframes ${id}-pop  { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes ${id}-grow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes ${id}-sway { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        @keyframes ${id}-twinkle { 0%,100% { opacity: .3; transform: scale(.8) } 50% { opacity: 1; transform: scale(1.1) } }
        .${id}-ground { stroke-dashoffset: 200; animation: ${id}-draw 1s .2s ease forwards }
        .${id}-soildot { transform: scale(0); opacity: 0 }
        .${id}-sd1 { animation: ${id}-pop .2s .7s ease forwards }
        .${id}-sd2 { animation: ${id}-pop .2s .8s ease forwards }
        .${id}-sd3 { animation: ${id}-pop .2s .9s ease forwards }
        .${id}-sd4 { animation: ${id}-pop .2s 1s ease forwards }
        .${id}-stem { transform-origin: 90px 135px; animation: ${id}-sway 4s 2s ease-in-out infinite }
        .${id}-stemline { stroke-dashoffset: 70; animation: ${id}-draw .8s 1s ease forwards }
        .${id}-leaf1 { transform: scale(0); opacity: 0; animation: ${id}-pop .4s 1.6s ease forwards }
        .${id}-leaf2 { transform: scale(0); opacity: 0; animation: ${id}-pop .4s 1.8s ease forwards }
        .${id}-leaf3 { transform: scale(0); opacity: 0; animation: ${id}-pop .4s 2s ease forwards }
        .${id}-bud { transform: scale(0); opacity: 0; animation: ${id}-pop .5s 2.2s ease forwards }
        .${id}-tw { animation: ${id}-twinkle 2s 2.5s ease-in-out infinite }
        .${id}-tw2 { animation: ${id}-twinkle 2.5s 3s ease-in-out infinite }
        .${id}-tw3 { animation: ${id}-twinkle 2.2s 2.8s ease-in-out infinite }
        .${id}-potdraw { stroke-dashoffset: 200; animation: ${id}-draw .8s .3s ease forwards }
        .${id}-potfill { transform: scale(0); opacity: 0; animation: ${id}-pop .4s .8s ease forwards }
      `}</style>
      {/* Ground/pot */}
      <path d="M55 145 Q90 155 125 145 L120 160 Q90 168 60 160 Z" fill="#8D6E63" opacity=".15" className={`${id}-potfill`} />
      <path d="M55 145 Q90 155 125 145 L120 160 Q90 168 60 160 Z"
        stroke="#8D6E63" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        strokeDasharray="200" className={`${id}-potdraw`} />
      {/* Soil line */}
      <path d="M58 145 C70 140 80 148 90 143 C100 138 110 146 122 142"
        stroke="#A1887F" strokeWidth="2" strokeLinecap="round" fill="none"
        strokeDasharray="200" className={`${id}-ground`} />
      {/* Soil texture dots */}
      <circle cx="72" cy="147" r="1.5" fill="#8D6E63" className={`${id}-soildot ${id}-sd1`} />
      <circle cx="85" cy="149" r="1.5" fill="#8D6E63" className={`${id}-soildot ${id}-sd2`} />
      <circle cx="98" cy="147" r="1.5" fill="#8D6E63" className={`${id}-soildot ${id}-sd3`} />
      <circle cx="108" cy="149" r="1.5" fill="#A1887F" className={`${id}-soildot ${id}-sd4`} />
      {/* Plant stem group */}
      <g className={`${id}-stem`}>
        {/* Main stem */}
        <path d="M90 140 C90 125 88 105 90 85 C91 72 89 60 90 48"
          stroke="#66BB6A" strokeWidth="3" strokeLinecap="round" fill="none"
          strokeDasharray="70" className={`${id}-stemline`} />
        {/* Left leaf */}
        <g className={`${id}-leaf1`}>
          <ellipse cx="72" cy="108" rx="14" ry="6" fill="#5E8F72" opacity=".7" transform="rotate(-30, 72, 108)" />
          <line x1="80" y1="112" x2="65" y2="104" stroke="#2E3D2F" strokeWidth=".8" opacity=".4" />
        </g>
        {/* Right leaf */}
        <g className={`${id}-leaf2`}>
          <ellipse cx="108" cy="90" rx="14" ry="6" fill="#66BB6A" opacity=".7" transform="rotate(25, 108, 90)" />
          <line x1="100" y1="93" x2="116" y2="87" stroke="#2E3D2F" strokeWidth=".8" opacity=".4" />
        </g>
        {/* Top left small leaf */}
        <g className={`${id}-leaf3`}>
          <ellipse cx="78" cy="65" rx="10" ry="4.5" fill="#81C784" opacity=".7" transform="rotate(-40, 78, 65)" />
        </g>
        {/* Flower bud */}
        <g className={`${id}-bud`}>
          <circle cx="90" cy="42" r="9" fill="#C7A24A" opacity=".85" />
          {/* Petals */}
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180
            const px = 90 + Math.cos(rad) * 14
            const py = 42 + Math.sin(rad) * 14
            return <circle key={deg} cx={px} cy={py} r="4" fill="#DCC07E" opacity=".5" />
          })}
          <circle cx="90" cy="42" r="5" fill="#C7A24A" />
        </g>
      </g>
      {/* Sparkle / twinkle accents */}
      <g className={`${id}-tw`}>
        <line x1="50" y1="55" x2="50" y2="65" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="45" y1="60" x2="55" y2="60" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className={`${id}-tw2`}>
        <line x1="130" y1="48" x2="130" y2="56" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="126" y1="52" x2="134" y2="52" stroke="#DCC07E" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className={`${id}-tw3`}>
        <line x1="45" y1="90" x2="45" y2="96" stroke="#5E8F72" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="42" y1="93" x2="48" y2="93" stroke="#5E8F72" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      {/* Floating accent circles */}
      <circle cx="140" cy="70" r="3" fill="#5E8F72" opacity=".4" className={`${id}-leaf1`} />
      <circle cx="40" cy="40" r="2.5" fill="#C7A24A" opacity=".4" className={`${id}-leaf2`} />
    </svg>
  )
}

const ILLUSTRATION_MAP: Record<IllustrationVariant, React.FC> = {
  empty: EmptyIllustration,
  search: SearchIllustration,
  error: ErrorIllustration,
  notFound: NotFoundIllustration,
  noData: NoDataIllustration,
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  /** Illustration variant. Defaults to 'empty'. */
  variant?: IllustrationVariant
  /** Override the illustration with a custom icon/element */
  icon?: React.ReactNode
  /** Main heading text */
  title: string
  /** Descriptive text below the title */
  description?: string
  /** Optional action element (e.g. a button) */
  action?: React.ReactNode
  /** Compact mode reduces padding */
  compact?: boolean
}

export function EmptyState({ variant = 'empty', icon, title, description, action, compact }: EmptyStateProps) {
  const Illustration = ILLUSTRATION_MAP[variant]
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: compact ? 5 : 8,
        px: 3,
        animation: `${fadeIn} 0.5s ease both`,
      }}
    >
      <Box sx={{ mb: 3, animation: `${float} 5s 1s ease-in-out infinite` }}>
        {icon ?? <Illustration />}
      </Box>

      <Typography
        sx={{
          fontWeight: 800,
          fontSize: compact ? '1.1rem' : '1.35rem',
          color: 'text.primary',
          mb: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </Typography>

      {description && (
        <Typography
          sx={{
            fontSize: '0.88rem',
            color: 'text.secondary',
            maxWidth: 380,
            lineHeight: 1.6,
            mb: action ? 3 : 0,
          }}
        >
          {description}
        </Typography>
      )}

      {action && <Box>{action}</Box>}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// ErrorState — for recoverable errors
// ---------------------------------------------------------------------------

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  action?: React.ReactNode
  compact?: boolean
}

export function ErrorState({
  title = 'Something went wrong',
  message = "We hit an unexpected bump. This is usually temporary — give it another try.",
  onRetry,
  retryLabel = 'Try again',
  action,
  compact,
}: ErrorStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: compact ? 5 : 8,
        px: 3,
        animation: `${fadeIn} 0.5s ease both`,
      }}
    >
      <Box sx={{ mb: 3, animation: `${float} 5s 1s ease-in-out infinite` }}>
        <ErrorIllustration />
      </Box>

      <Typography sx={{ fontWeight: 800, fontSize: compact ? '1.1rem' : '1.35rem', color: 'text.primary', mb: 1 }}>
        {title}
      </Typography>

      <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', maxWidth: 400, lineHeight: 1.6, mb: 3 }}>
        {message}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
        {onRetry && (
          <Button variant="contained" onClick={onRetry}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3, boxShadow: '0 2px 12px rgba(46, 61, 47,0.25)' }}>
            {retryLabel}
          </Button>
        )}
        {action}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// ItemNotFound — for specific missing resources
// ---------------------------------------------------------------------------

export interface ItemNotFoundProps {
  itemType?: string
  message?: string
  onBack?: () => void
  backLabel?: string
  action?: React.ReactNode
  compact?: boolean
}

export function ItemNotFound({
  itemType = 'Item',
  message,
  onBack,
  backLabel = 'Go back',
  action,
  compact,
}: ItemNotFoundProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: compact ? 5 : 8,
        px: 3,
        animation: `${fadeIn} 0.5s ease both`,
      }}
    >
      <Box sx={{ mb: 3, animation: `${float} 5s 1s ease-in-out infinite` }}>
        <NotFoundIllustration />
      </Box>

      <Typography sx={{ fontWeight: 800, fontSize: compact ? '1.1rem' : '1.35rem', color: 'text.primary', mb: 1 }}>
        {itemType} not found
      </Typography>

      <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', maxWidth: 400, lineHeight: 1.6, mb: 3 }}>
        {message ?? `The ${itemType.toLowerCase()} you're looking for may have been removed, renamed, or doesn't exist.`}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
        {onBack && (
          <Button variant="outlined" onClick={onBack}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3 }}>
            {backLabel}
          </Button>
        )}
        {action}
      </Box>
    </Box>
  )
}
