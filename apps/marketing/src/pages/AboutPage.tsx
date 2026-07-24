import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { keyframes } from '@emotion/react'

// ─── Animations ─────────────────────────────────────────────

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`

const drawPath = keyframes`
  to { stroke-dashoffset: 0; }
`

const breathe = keyframes`
  0%, 100% { opacity: 0.25; transform: scale(1); }
  50%      { opacity: 0.4; transform: scale(1.03); }
`

const markerSwipe = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`

const sway = keyframes`
  0%, 100% { transform: rotate(-2deg); }
  50%      { transform: rotate(2deg); }
`

const floatUp = keyframes`
  0%   { transform: translateY(0) rotate(0deg); opacity: 0.5; }
  50%  { opacity: 0.3; }
  100% { transform: translateY(-180px) rotate(15deg); opacity: 0; }
`

const sparkle = keyframes`
  0%, 100% { opacity: 0.2; transform: scale(0.8) rotate(0deg); }
  50%      { opacity: 0.8; transform: scale(1.1) rotate(180deg); }
`

const bloomIn = keyframes`
  from { transform: scale(0); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
`

// Squiggly line SVGs
const SQUIGGLE_GOLD = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='6' viewBox='0 0 60 6'%3E%3Cpath d='M0,3 C5,0 10,6 15,3 C20,0 25,6 30,3 C35,0 40,6 45,3 C50,0 55,6 60,3' fill='none' stroke='%23C7A24A' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`
const SQUIGGLE_GREEN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='6' viewBox='0 0 60 6'%3E%3Cpath d='M0,3 C5,0 10,6 15,3 C20,0 25,6 30,3 C35,0 40,6 45,3 C50,0 55,6 60,3' fill='none' stroke='%232E3D2F' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`

// ─── Team Data ──────────────────────────────────────────────

interface TeamMember {
  name: string
  role: string
  initials: string
  color: string
  bio: string
  doodleType: 'star' | 'heart' | 'leaf' | 'circle' | 'diamond' | 'wave'
}

const teamMembers: TeamMember[] = [
  { name: 'Kofi Owusu', role: 'Co-Founder & CEO', initials: 'KO', color: '#2E3D2F', bio: 'Visionary leader passionate about democratizing giving across Ghana.', doodleType: 'star' },
  { name: 'Adwoa Agyeman', role: 'Co-Founder & CTO', initials: 'AA', color: '#1565C0', bio: 'Architect of the trust infrastructure powering transparent donations.', doodleType: 'circle' },
  { name: 'Abena Sarpong', role: 'Head of Community', initials: 'AS', color: '#6A1B9A', bio: 'Building bridges between donors and communities in all 16 regions of Ghana.', doodleType: 'heart' },
  { name: 'Yaw Darko', role: 'Head of Trust & Safety', initials: 'YD', color: '#C62828', bio: 'Guardian of platform integrity with a zero-tolerance fraud policy.', doodleType: 'diamond' },
  { name: 'Kojo Antwi', role: 'Head of Partnerships', initials: 'KA', color: '#A07E33', bio: 'Forging alliances with NGOs, government agencies, and corporate partners.', doodleType: 'leaf' },
  { name: 'Kwame Boateng', role: 'Head of Engineering', initials: 'KB', color: '#00695C', bio: 'Leading the team building scalable, secure fintech for Ghana.', doodleType: 'wave' },
]

const DOODLE_PATHS: Record<string, string> = {
  star: 'M0,-8 L2.3,-3.2 L7.6,-2.5 L3.8,1.8 L4.7,7 L0,4 L-4.7,7 L-3.8,1.8 L-7.6,-2.5 L-2.3,-3.2 Z',
  heart: 'M0,3 C0,-3 -7,-3 -7,3 C-7,9 0,13 0,13 C0,13 7,9 7,3 C7,-3 0,-3 0,3 Z',
  leaf: 'M0,-8 C4,-4 8,0 4,8 C2,4 -2,4 -4,8 C-8,0 -4,-4 0,-8 Z',
  circle: 'M0,-7 A7,7 0 1,1 0.01,-7 Z',
  diamond: 'M0,-8 L6,0 L0,8 L-6,0 Z',
  wave: 'M-8,0 C-4,-6 0,6 4,-6 C8,6 8,0 8,0',
}

// ─── Floating doodle elements for backgrounds ───────────────

const FLOAT_SHAPES = [
  { d: DOODLE_PATHS.star, x: '8%', y: '15%', size: 1.2, delay: 0, color: '#5E8F72' },
  { d: DOODLE_PATHS.heart, x: '92%', y: '25%', size: 1, delay: 1, color: '#C7A24A' },
  { d: DOODLE_PATHS.leaf, x: '15%', y: '75%', size: 0.8, delay: 2, color: '#A8B5A0' },
  { d: DOODLE_PATHS.circle, x: '85%', y: '70%', size: 1.1, delay: 0.5, color: '#C7A24A' },
  { d: DOODLE_PATHS.diamond, x: '50%', y: '10%', size: 0.9, delay: 1.5, color: '#5E8F72' },
  { d: DOODLE_PATHS.wave, x: '75%', y: '85%', size: 1, delay: 3, color: '#A8B5A0' },
]

// ─── Page ───────────────────────────────────────────────────

function AboutPage() {
  return (
    <Box component="main" sx={{ flex: 1 }}>
      {/* ═══════════════════════════════════════════════════════
          HERO — Dark canvas with hand-drawn tree illustration
          ═══════════════════════════════════════════════════════ */}
      <Box
        sx={{
          position: 'relative',
          bgcolor: '#0A0F0A',
          color: '#fff',
          py: { xs: 10, md: 14 },
          px: { xs: 3, md: 6 },
          overflow: 'hidden',
        }}
      >
        {/* Watercolor glow blobs */}
        <Box sx={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(76,175,80,0.12) 0%, transparent 70%)', top: '10%', left: '15%', filter: 'blur(50px)', animation: `${breathe} 8s ease-in-out infinite` }} />
        <Box sx={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(199, 162, 74,0.08) 0%, transparent 70%)', bottom: '10%', right: '20%', filter: 'blur(40px)', animation: `${breathe} 10s 2s ease-in-out infinite` }} />

        {/* Animated SVG doodles */}
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {/* Hand-drawn connecting arcs */}
            {[
              'M80,60 C160,10 280,90 400,40 C520,-10 640,70 760,30',
              'M0,150 C120,100 240,180 360,120 C480,60 600,140 720,100',
            ].map((d, i) => (
              <path key={i} d={d} fill="none" stroke={i === 0 ? 'rgba(76,175,80,0.08)' : 'rgba(199, 162, 74,0.06)'} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="800" strokeDashoffset="800" style={{ animation: `${drawPath} 4s ${i * 0.8}s ease forwards` }} />
            ))}
            {/* Scattered sparkles */}
            {[
              { x: 150, y: 40 }, { x: 400, y: 80 }, { x: 650, y: 30 },
              { x: 250, y: 130 }, { x: 550, y: 110 }, { x: 800, y: 60 },
            ].map((s, i) => (
              <g key={i} transform={`translate(${s.x},${s.y})`} style={{ animation: `${sparkle} ${2.5 + i * 0.3}s ${i * 0.4}s ease-in-out infinite` }}>
                <line x1={0} y1={-4} x2={0} y2={4} stroke={i % 2 === 0 ? '#5E8F72' : '#C7A24A'} strokeWidth="1" strokeLinecap="round" />
                <line x1={-4} y1={0} x2={4} y2={0} stroke={i % 2 === 0 ? '#5E8F72' : '#C7A24A'} strokeWidth="1" strokeLinecap="round" />
              </g>
            ))}
          </svg>
        </Box>

        {/* Floating doodle shapes */}
        {FLOAT_SHAPES.map((shape, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: shape.x,
              top: shape.y,
              opacity: 0.06,
              animation: `${sway} ${5 + i}s ${shape.delay}s ease-in-out infinite`,
              pointerEvents: 'none',
            }}
          >
            <svg width="40" height="40" viewBox="-12 -12 24 24">
              <path d={shape.d} fill="none" stroke={shape.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>
        ))}

        {/* Content */}
        <Box sx={{ maxWidth: 800, mx: 'auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Typography
            sx={{
              fontFamily: '"TT Squares", sans-serif',
              fontWeight: 900,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              lineHeight: 1.1,
              mb: 2,
              animation: `${fadeInUp} 0.7s ease`,
              position: 'relative',
              display: 'inline-block',
            }}
          >
            Together, We Rise
            <Box component="span" sx={{ position: 'absolute', bottom: -8, left: '20%', width: '60%', height: 6, backgroundImage: SQUIGGLE_GOLD, backgroundRepeat: 'repeat-x', backgroundSize: '60px 6px', animation: `${markerSwipe} 0.8s 0.5s ease both`, transformOrigin: 'left' }} />
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1rem', md: '1.15rem' },
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.7,
              maxWidth: 600,
              mx: 'auto',
              mt: 3,
              fontStyle: 'italic',
              animation: `${fadeInUp} 0.7s 0.15s ease both`,
            }}
          >
            UbuntuFund is Ghana&apos;s trust infrastructure for giving — empowering communities across the country through transparent, secure crowdfunding.
          </Typography>
        </Box>

        {/* Bottom ink border */}
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, overflow: 'hidden' }}>
          <svg width="100%" height="3" viewBox="0 0 1200 3" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d="M0,1.5 C50,0 100,3 150,1.5 C200,0 250,3 300,1.5 C350,0 400,3 450,1.5 C500,0 550,3 600,1.5 C650,0 700,3 750,1.5 C800,0 850,3 900,1.5 C950,0 1000,3 1050,1.5 C1100,0 1150,3 1200,1.5" fill="none" stroke="rgba(76,175,80,0.2)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Box>
      </Box>

      {/* ═══════════════════════════════════════════════════════
          MISSION & VISION — 2-column grid with doodle icons
          ═══════════════════════════════════════════════════════ */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          bgcolor: '#FAF8F0',
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.015) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Mission */}
        <Box
          sx={{
            p: { xs: 4, md: 6 },
            borderRight: { md: '1px solid rgba(0,0,0,0.06)' },
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            position: 'relative',
            overflow: 'hidden',
            animation: `${fadeInUp} 0.6s ease`,
            '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: '#2E3D2F', opacity: 0.4 },
          }}
        >
          {/* Doodle icon */}
          <Box sx={{ mb: 3 }}>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#2E3D2F" strokeWidth="2" strokeLinecap="round" strokeDasharray="200" strokeDashoffset="200" style={{ animation: `${drawPath} 1.2s 0.3s ease forwards` }} />
              <path d="M16,24 L22,30 L32,18" fill="none" stroke="#2E3D2F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" strokeDashoffset="40" style={{ animation: `${drawPath} 0.6s 1.2s ease forwards` }} />
            </svg>
          </Box>
          <Typography sx={{ fontSize: '0.65rem', color: '#C7A24A', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, mb: 1 }}>
            Our Mission
          </Typography>
          <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#1a1a1a', mb: 2, lineHeight: 1.2 }}>
            Democratizing Generosity Across Ghana
          </Typography>
          <Typography sx={{ fontSize: '0.92rem', color: 'rgba(0,0,0,0.5)', lineHeight: 1.8 }}>
            We believe that every community has the power to uplift itself when given the right tools. UbuntuFund provides the infrastructure that connects donors with verified causes, ensuring that every contribution reaches those who need it most.
          </Typography>
          {/* Faint doodle in corner */}
          <Box sx={{ position: 'absolute', bottom: 16, right: 16, opacity: 0.04, animation: `${sway} 6s ease-in-out infinite` }}>
            <svg width="50" height="50" viewBox="-12 -12 24 24"><path d={DOODLE_PATHS.star} fill="none" stroke="#2E3D2F" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </Box>
        </Box>

        {/* Vision */}
        <Box
          sx={{
            p: { xs: 4, md: 6 },
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            position: 'relative',
            overflow: 'hidden',
            animation: `${fadeInUp} 0.6s 0.1s ease both`,
            '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: '#C7A24A', opacity: 0.4 },
          }}
        >
          <Box sx={{ mb: 3 }}>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <path d="M12,36 L24,12 L36,36" fill="none" stroke="#C7A24A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="80" strokeDashoffset="80" style={{ animation: `${drawPath} 1s 0.5s ease forwards` }} />
              <circle cx="24" cy="16" r="4" fill="none" stroke="#C7A24A" strokeWidth="2" strokeDasharray="30" strokeDashoffset="30" style={{ animation: `${drawPath} 0.6s 1.3s ease forwards` }} />
              <line x1="18" y1="28" x2="30" y2="28" stroke="#C7A24A" strokeWidth="2" strokeLinecap="round" strokeDasharray="20" strokeDashoffset="20" style={{ animation: `${drawPath} 0.4s 1.6s ease forwards` }} />
            </svg>
          </Box>
          <Typography sx={{ fontSize: '0.65rem', color: '#C7A24A', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, mb: 1 }}>
            Our Vision
          </Typography>
          <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#1a1a1a', mb: 2, lineHeight: 1.2 }}>
            A Ghana Where No Cause Goes Unfunded
          </Typography>
          <Typography sx={{ fontSize: '0.92rem', color: 'rgba(0,0,0,0.5)', lineHeight: 1.8 }}>
            We envision a future where geographic and economic barriers no longer prevent communities from accessing the resources they need. By 2030, we aim to facilitate over GH₵ 1 billion in donations across all 16 regions of Ghana.
          </Typography>
          <Box sx={{ position: 'absolute', bottom: 16, right: 16, opacity: 0.04, animation: `${sway} 7s 1s ease-in-out infinite` }}>
            <svg width="50" height="50" viewBox="-12 -12 24 24"><path d={DOODLE_PATHS.diamond} fill="none" stroke="#C7A24A" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </Box>
        </Box>
      </Box>

      {/* ═══════════════════════════════════════════════════════
          UBUNTU PHILOSOPHY — Dark section with animated tree
          ═══════════════════════════════════════════════════════ */}
      <Box
        sx={{
          bgcolor: '#0A0F0A',
          color: '#fff',
          py: { xs: 8, md: 10 },
          px: { xs: 3, md: 6 },
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Animated tree drawing */}
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
          <svg width="300" height="400" viewBox="0 0 300 400" style={{ opacity: 0.06 }}>
            {/* Trunk */}
            <path d="M150,380 C148,340 152,300 150,260 C149,230 151,200 150,170" fill="none" stroke="#5E8F72" strokeWidth="3" strokeLinecap="round" strokeDasharray="400" strokeDashoffset="400" style={{ animation: `${drawPath} 3s ease forwards` }} />
            {/* Roots */}
            <path d="M150,380 C130,395 100,400 80,398" fill="none" stroke="#5E8F72" strokeWidth="2" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="100" style={{ animation: `${drawPath} 1.5s ease forwards` }} />
            <path d="M150,380 C170,395 200,400 220,398" fill="none" stroke="#5E8F72" strokeWidth="2" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="100" style={{ animation: `${drawPath} 1.5s 0.2s ease forwards` }} />
            {/* Branches */}
            <path d="M150,260 C120,240 90,235 65,230" fill="none" stroke="#5E8F72" strokeWidth="2" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="100" style={{ animation: `${drawPath} 1.5s 1.5s ease forwards` }} />
            <path d="M150,240 C180,220 210,218 235,215" fill="none" stroke="#5E8F72" strokeWidth="2" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="100" style={{ animation: `${drawPath} 1.5s 1.8s ease forwards` }} />
            <path d="M150,210 C125,195 100,190 80,188" fill="none" stroke="#5E8F72" strokeWidth="2" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="100" style={{ animation: `${drawPath} 1.5s 2s ease forwards` }} />
            <path d="M150,190 C175,175 200,172 220,168" fill="none" stroke="#5E8F72" strokeWidth="2" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="100" style={{ animation: `${drawPath} 1.5s 2.2s ease forwards` }} />
            {/* Leaves */}
            {[
              { cx: 65, cy: 225, d: 2.8 }, { cx: 235, cy: 210, d: 3.0 },
              { cx: 80, cy: 183, d: 3.2 }, { cx: 220, cy: 163, d: 3.4 },
              { cx: 150, cy: 160, d: 3.6 }, { cx: 130, cy: 170, d: 3.5 },
              { cx: 170, cy: 168, d: 3.5 },
            ].map((l, i) => (
              <ellipse key={i} cx={l.cx} cy={l.cy} rx={10} ry={7} fill="#5E8F72" opacity={0} style={{ animation: `${bloomIn} 0.5s ${l.d}s ease both` }} />
            ))}
            {/* Golden accent leaves */}
            {[
              { cx: 150, cy: 155, d: 3.8 }, { cx: 95, cy: 225, d: 3.6 }, { cx: 205, cy: 210, d: 3.7 },
            ].map((l, i) => (
              <ellipse key={`g-${i}`} cx={l.cx} cy={l.cy} rx={7} ry={5} fill="#C7A24A" opacity={0} style={{ animation: `${bloomIn} 0.5s ${l.d}s ease both` }} />
            ))}
          </svg>
        </Box>

        {/* Floating particles */}
        {Array.from({ length: 8 }, (_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${15 + i * 10}%`,
              bottom: '20%',
              width: 4, height: 4,
              bgcolor: i % 2 === 0 ? '#5E8F72' : '#C7A24A',
              opacity: 0,
              animation: `${floatUp} ${6 + i}s ${i * 0.8}s ease-in infinite`,
              pointerEvents: 'none',
            }}
          />
        ))}

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 700, mx: 'auto' }}>
          <Typography sx={{ fontSize: '0.65rem', color: '#C7A24A', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, mb: 1.5, animation: `${fadeIn} 0.6s ease` }}>
            The Ubuntu Philosophy
          </Typography>
          <Typography
            sx={{
              fontFamily: '"TT Squares", sans-serif',
              fontWeight: 900,
              fontSize: { xs: '2rem', md: '2.5rem' },
              lineHeight: 1.1,
              mb: 3,
              fontStyle: 'italic',
              animation: `${fadeInUp} 0.6s 0.1s ease both`,
              position: 'relative',
              display: 'inline-block',
            }}
          >
            &ldquo;I am because we are&rdquo;
            <Box component="span" sx={{ position: 'absolute', bottom: -6, left: '10%', width: '80%', height: 6, backgroundImage: SQUIGGLE_GREEN, backgroundRepeat: 'repeat-x', backgroundSize: '60px 6px', animation: `${markerSwipe} 1s 0.6s ease both`, transformOrigin: 'left' }} />
          </Typography>
          <Typography
            sx={{
              fontSize: '0.95rem',
              color: 'rgba(255,255,255,0.45)',
              lineHeight: 1.8,
              mt: 3,
              animation: `${fadeInUp} 0.6s 0.2s ease both`,
            }}
          >
            Ubuntu is a Nguni Bantu term meaning &ldquo;humanity.&rdquo; It speaks to our interconnectedness — the idea that a person is a person through other people. This philosophy is the heartbeat of our platform. When one community thrives, we all thrive. When one person gives, the ripple effect touches countless lives.
          </Typography>
        </Box>

        {/* Top and bottom ink borders */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, overflow: 'hidden' }}>
          <svg width="100%" height="3" viewBox="0 0 1200 3" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d="M0,1.5 C50,0 100,3 150,1.5 C200,0 250,3 300,1.5 C350,0 400,3 450,1.5 C500,0 550,3 600,1.5 C650,0 700,3 750,1.5 C800,0 850,3 900,1.5 C950,0 1000,3 1050,1.5 C1100,0 1150,3 1200,1.5" fill="none" stroke="rgba(76,175,80,0.15)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Box>
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, overflow: 'hidden' }}>
          <svg width="100%" height="3" viewBox="0 0 1200 3" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d="M0,1.5 C50,0 100,3 150,1.5 C200,0 250,3 300,1.5 C350,0 400,3 450,1.5 C500,0 550,3 600,1.5 C650,0 700,3 750,1.5 C800,0 850,3 900,1.5 C950,0 1000,3 1050,1.5 C1100,0 1150,3 1200,1.5" fill="none" stroke="rgba(76,175,80,0.15)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Box>
      </Box>

      {/* ═══════════════════════════════════════════════════════
          TEAM — Grid cards on paper background
          ═══════════════════════════════════════════════════════ */}
      <Box
        sx={{
          bgcolor: '#FAF8F0',
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.015) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          py: { xs: 6, md: 8 },
          px: { xs: 3, md: 6 },
        }}
      >
        {/* Section header */}
        <Box sx={{ textAlign: 'center', mb: 6, maxWidth: 1200, mx: 'auto' }}>
          <Typography sx={{ fontSize: '0.65rem', color: '#C7A24A', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, mb: 1 }}>
            Our Team
          </Typography>
          <Typography
            sx={{
              fontFamily: '"TT Squares", sans-serif',
              fontWeight: 900,
              fontSize: { xs: '1.5rem', md: '1.8rem' },
              color: '#1a1a1a',
              position: 'relative',
              display: 'inline-block',
            }}
          >
            The People Behind UbuntuFund
            <Box component="span" sx={{ position: 'absolute', bottom: -6, left: '15%', width: '70%', height: 6, backgroundImage: SQUIGGLE_GOLD, backgroundRepeat: 'repeat-x', backgroundSize: '60px 6px', animation: `${markerSwipe} 0.8s 0.3s ease both`, transformOrigin: 'left' }} />
          </Typography>
        </Box>

        {/* Team grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            border: '1px solid rgba(0,0,0,0.06)',
            borderBottom: 'none',
            borderRight: 'none',
            maxWidth: 1200,
            mx: 'auto',
          }}
        >
          {teamMembers.map((member, index) => (
            <Box
              key={member.name}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRight: '1px solid rgba(0,0,0,0.06)',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                p: { xs: 3, md: 4 },
                bgcolor: '#fff',
                transition: 'all 0.35s ease',
                animation: `${fadeInUp} 0.5s ease ${index * 0.08}s both`,
                cursor: 'default',
                '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: member.color, opacity: 0.4, transition: 'opacity 0.3s ease' },
                '&:hover': {
                  bgcolor: '#FEFEFE',
                  '&::before': { opacity: 1 },
                  '& .member-doodle': { opacity: 0.12, transform: 'scale(1.1) rotate(10deg)' },
                  '& .member-avatar': { transform: 'scale(1.05)' },
                  '& .member-line': { width: '100%' },
                },
              }}
            >
              {/* Background doodle */}
              <Box className="member-doodle" sx={{ position: 'absolute', top: 16, right: 16, opacity: 0.06, transition: 'all 0.5s ease', pointerEvents: 'none' }}>
                <svg width="60" height="60" viewBox="-12 -12 24 24">
                  <path d={DOODLE_PATHS[member.doodleType]} fill="none" stroke={member.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Box>

              {/* Large initials watermark */}
              <Typography sx={{ position: 'absolute', right: -8, bottom: -12, fontFamily: '"TT Squares", monospace', fontWeight: 900, fontSize: '5.5rem', color: member.color, opacity: 0.04, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>
                {member.initials}
              </Typography>

              <Box sx={{ position: 'relative', zIndex: 1 }}>
                {/* Square avatar with sketchy border */}
                <Box
                  className="member-avatar"
                  sx={{
                    width: 64, height: 64, bgcolor: member.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mb: 2.5, transition: 'transform 0.3s ease', position: 'relative',
                    '&::after': { content: '""', position: 'absolute', inset: -3, border: `2px solid ${member.color}`, opacity: 0.25, transform: 'rotate(-1.5deg)', pointerEvents: 'none' },
                  }}
                >
                  <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 900, fontSize: '1.25rem', color: '#fff', letterSpacing: '0.04em' }}>
                    {member.initials}
                  </Typography>
                </Box>

                <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 700, fontSize: '1.05rem', color: '#1a1a1a', mb: 0.3 }}>
                  {member.name}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: member.color, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 2 }}>
                  {member.role}
                </Typography>

                <Box className="member-line" sx={{ width: '40%', height: 2, bgcolor: member.color, opacity: 0.25, mb: 2, transition: 'width 0.4s ease' }} />

                <Typography sx={{ fontSize: '0.82rem', color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, fontStyle: 'italic' }}>
                  {member.bio}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

export default AboutPage
