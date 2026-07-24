import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import MuiLink from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import FacebookIcon from '@mui/icons-material/Facebook'
import XIcon from '@mui/icons-material/X'
import InstagramIcon from '@mui/icons-material/Instagram'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import YouTubeIcon from '@mui/icons-material/YouTube'
import { keyframes } from '@mui/material/styles'
import TimelineIcon from '@mui/icons-material/Timeline'
import CategoryIcon from '@mui/icons-material/Category'
import DiamondIcon from '@mui/icons-material/Diamond'
import BusinessIcon from '@mui/icons-material/Business'
import InfoIcon from '@mui/icons-material/Info'
import ArticleIcon from '@mui/icons-material/Article'
import MailIcon from '@mui/icons-material/Mail'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import GavelIcon from '@mui/icons-material/Gavel'
import LockIcon from '@mui/icons-material/Lock'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { scrollToHash } from '@/lib/scroll'
import { SHAPE } from '@ubuntu-fund/ui'

const pulse = keyframes`
  0%, 100% { opacity: 0.12; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(1.05); }
`

const drift = keyframes`
  0%, 100% { transform: translateY(0) translateX(0); }
  25% { transform: translateY(-8px) translateX(4px); }
  75% { transform: translateY(6px) translateX(-3px); }
`

const footerSections = [
  {
    title: 'Platform',
    links: [
      { label: 'How It Works', to: '/#how-it-works', anchor: true, icon: <TimelineIcon sx={{ fontSize: 15 }} /> },
      { label: 'Campaign Types', to: '/#campaign-types', anchor: true, icon: <CategoryIcon sx={{ fontSize: 15 }} /> },
      { label: 'Pricing', to: '/pricing', icon: <DiamondIcon sx={{ fontSize: 15 }} /> },
      { label: 'For Organizations', to: '/for-organizations', icon: <BusinessIcon sx={{ fontSize: 15 }} /> },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', to: '/about', icon: <InfoIcon sx={{ fontSize: 15 }} /> },
      { label: 'Blog', to: '/blog', icon: <ArticleIcon sx={{ fontSize: 15 }} /> },
      { label: 'Contact', to: '/contact', icon: <MailIcon sx={{ fontSize: 15 }} /> },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', to: '/help', icon: <SupportAgentIcon sx={{ fontSize: 15 }} /> },
      { label: 'Success Stories', to: '/#testimonials', anchor: true, icon: <AutoStoriesIcon sx={{ fontSize: 15 }} /> },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', to: '/terms', icon: <GavelIcon sx={{ fontSize: 15 }} /> },
      { label: 'Privacy Policy', to: '/privacy', icon: <LockIcon sx={{ fontSize: 15 }} /> },
      { label: 'Refund Policy', to: '/refund-policy', icon: <SyncAltIcon sx={{ fontSize: 15 }} /> },
    ],
  },
]

const socialLinks = [
  { icon: <FacebookIcon />, label: 'Facebook', href: 'https://facebook.com/ubuntufund' },
  { icon: <XIcon />, label: 'X', href: 'https://x.com/ubuntufund' },
  { icon: <InstagramIcon />, label: 'Instagram', href: 'https://instagram.com/ubuntufund' },
  { icon: <LinkedInIcon />, label: 'LinkedIn', href: 'https://linkedin.com/company/ubuntufund' },
  { icon: <YouTubeIcon />, label: 'YouTube', href: 'https://youtube.com/@ubuntufund' },
]

const linkStyle = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: '0.875rem',
  textDecoration: 'none',
  transition: 'color 0.2s ease, transform 0.2s ease',
  display: 'inline-block',
  '&:hover': { color: '#DCC07E', transform: 'translateX(3px)' },
}

function Footer() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  // SPA-aware section links: same-page anchors scroll smoothly; cross-page
  // anchors navigate first, then scroll once the section has mounted.
  function handleAnchor(e: React.MouseEvent, to: string) {
    e.preventDefault()
    const [path, hash] = to.split('#')
    const target = path || '/'
    if (!hash) {
      navigate(target)
      return
    }
    if (pathname === target) {
      scrollToHash(hash)
      return
    }
    navigate(to)
    scrollToHash(hash)
  }
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [subscribeMessage, setSubscribeMessage] = useState('')

  const handleSubscribe = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubscribeStatus('error')
      setSubscribeMessage('Please enter a valid email')
      return
    }
    setSubscribeStatus('loading')
    try {
      const res = await fetch('/api/v1/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      // A missing/misrouted endpoint answers with an HTML error page, not
      // JSON. Guard on both status and content-type before parsing so a
      // 404/500 never surfaces as an "Unexpected token '<'" JSON error.
      const isJson = res.headers
        .get('content-type')
        ?.toLowerCase()
        .includes('application/json')
      const data = isJson ? await res.json() : null

      if (!res.ok || !data) {
        throw new Error('subscribe-failed')
      }

      setSubscribeStatus('success')
      setSubscribeMessage(data.data?.message ?? 'Successfully subscribed!')
      setEmail('')
      setTimeout(() => setSubscribeStatus('idle'), 4000)
    } catch {
      setSubscribeStatus('error')
      setSubscribeMessage("Couldn't subscribe. Please try again.")
      setTimeout(() => setSubscribeStatus('idle'), 4000)
    }
  }

  function isFooterLinkActive(to: string, anchor?: boolean): boolean {
    if (anchor) return false
    const [path] = to.split('#')
    return pathname === (path || '/')
  }

  return (
    <Box
      component="footer"
      sx={{
        position: 'relative',
        background: 'linear-gradient(180deg, #080f09 0%, #0a1a0d 30%, #0d1f10 60%, #0a1a0d 100%)',
        overflow: 'hidden',
      }}
    >
      {/* --- Decorative background layer --- */}

      {/* Subtle grid pattern */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          pointerEvents: 'none',
        }}
      />

      {/* Top edge glow line */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent 5%, rgba(46, 61, 47,0.4) 30%, rgba(199, 162, 74,0.3) 50%, rgba(46, 61, 47,0.4) 70%, transparent 95%)',
        }}
      />

      {/* Ambient glow orbs */}
      <Box
        sx={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(46, 61, 47,0.06), transparent 65%)',
          top: -200,
          left: -100,
          animation: `${pulse} 10s ease-in-out infinite`,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(199, 162, 74,0.04), transparent 65%)',
          bottom: -150,
          right: -80,
          animation: `${pulse} 8s ease-in-out infinite 3s`,
        }}
      />

      {/* Floating accent dots */}
      {[
        { size: 6, top: '15%', left: '5%', delay: 0, color: 'rgba(199, 162, 74,0.25)' },
        { size: 4, top: '40%', left: '92%', delay: 1.5, color: 'rgba(255,255,255,0.15)' },
        { size: 8, top: '70%', left: '88%', delay: 0.5, color: 'rgba(199, 162, 74,0.15)' },
        { size: 5, top: '80%', left: '12%', delay: 2, color: 'rgba(255,255,255,0.1)' },
      ].map(({ size, top, left, delay, color }, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: '50%',
            background: color,
            top,
            left,
            animation: `${drift} ${5 + delay}s ease-in-out infinite`,
            animationDelay: `${delay}s`,
            display: { xs: 'none', md: 'block' },
          }}
        />
      ))}

      {/* Decorative rings */}
      <Box
        sx={{
          position: 'absolute',
          width: 250,
          height: 250,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.025)',
          top: '10%',
          right: '8%',
          display: { xs: 'none', lg: 'block' },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 180,
          height: 180,
          borderRadius: '50%',
          border: '1px solid rgba(199, 162, 74,0.04)',
          bottom: '20%',
          left: '5%',
          display: { xs: 'none', lg: 'block' },
        }}
      />

      {/* --- Content --- */}
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, pt: { xs: 7, md: 10 }, pb: 4 }}>
        {/* Top section: brand + newsletter */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'flex-end' },
            gap: 4,
            mb: { xs: 5, md: 7 },
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                component="img"
                src="/favicon.svg"
                alt="UbuntuFund"
                sx={{ width: 36, height: 36 }}
              />
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#fff' }}>
                Ubuntu
                <Box component="span" sx={{ color: '#C7A24A' }}>Fund</Box>
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255,255,255,0.45)', maxWidth: 340, lineHeight: 1.7 }}
            >
              Ghana's trust infrastructure for giving. Empowering communities
              through transparent, secure crowdfunding built on the Ubuntu philosophy.
            </Typography>
          </Box>

          {/* Newsletter */}
          <Box sx={{ width: { xs: '100%', md: 400 } }}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1.5, fontWeight: 600 }}>
              Stay in the loop
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: SHAPE.card,
                p: 0.5,
                transition: 'border-color 0.2s ease',
                '&:focus-within': { borderColor: 'rgba(199, 162, 74,0.3)' },
              }}
            >
              <Box
                component="input"
                placeholder="your@email.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSubscribe()}
                sx={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  bgcolor: 'transparent',
                  color: '#fff',
                  fontSize: '0.875rem',
                  px: 1.5,
                  fontFamily: 'inherit',
                  '&::placeholder': { color: 'rgba(255,255,255,0.25)' },
                }}
              />
              <Button
                variant="contained"
                color="secondary"
                size="small"
                onClick={handleSubscribe}
                disabled={subscribeStatus === 'loading'}
                sx={{
                  borderRadius: SHAPE.sm,
                  px: 3,
                  py: 0.8,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}
              >
                {subscribeStatus === 'loading' ? <CircularProgress size={16} color="inherit" /> : 'Subscribe'}
              </Button>
            </Box>
            {subscribeStatus === 'success' && (
              <Typography sx={{ color: '#5E8F72', fontSize: '0.78rem', mt: 1, fontWeight: 600 }}>
                {subscribeMessage}
              </Typography>
            )}
            {subscribeStatus === 'error' && (
              <Typography sx={{ color: '#ef5350', fontSize: '0.78rem', mt: 1, fontWeight: 600 }}>
                {subscribeMessage}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Gradient divider */}
        <Box
          sx={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), rgba(199, 162, 74,0.1), rgba(255,255,255,0.06), transparent)',
            mb: { xs: 4, md: 5 },
          }}
        />

        {/* Link columns */}
        <Grid container spacing={3} sx={{ mb: { xs: 4, md: 6 } }}>
          {footerSections.map((section) => (
            <Grid size={{ xs: 6, sm: 3 }} key={section.title}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  color: '#C7A24A',
                  fontSize: '0.75rem',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}
              >
                {section.title}
              </Typography>
              <Stack spacing={1.3}>
                {section.links.map((link) => {
                  const active = isFooterLinkActive(link.to, link.anchor)
                  const iconColor = active ? '#DCC07E' : 'rgba(255,255,255,0.25)'
                  const activeSx = active
                    ? { color: '#DCC07E', fontWeight: 600 }
                    : {}
                  const inner = (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ color: iconColor, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
                        {link.icon}
                      </Box>
                      {link.label}
                    </Box>
                  )
                  return link.anchor ? (
                    <MuiLink
                      key={link.label}
                      href={link.to}
                      onClick={(e) => handleAnchor(e, link.to)}
                      underline="none"
                      sx={{ ...linkStyle, ...activeSx, '&:hover .MuiBox-root:first-of-type': { color: '#C7A24A' } }}
                    >
                      {inner}
                    </MuiLink>
                  ) : (
                    <MuiLink key={link.label} component={Link} to={link.to} underline="none" sx={{ ...linkStyle, ...activeSx, '&:hover .MuiBox-root:first-of-type': { color: '#C7A24A' } }}>
                      {inner}
                    </MuiLink>
                  )
                })}
              </Stack>
            </Grid>
          ))}
        </Grid>

        {/* Gradient divider */}
        <Box
          sx={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), rgba(199, 162, 74,0.08), rgba(255,255,255,0.06), transparent)',
            mb: 3,
          }}
        />

        {/* Bottom bar */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>
            &copy; {new Date().getFullYear()} UbuntuFund. All rights reserved.
          </Typography>

          <Stack direction="row" spacing={0.5}>
            {socialLinks.map((social) => (
              <IconButton
                key={social.label}
                component="a"
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                size="small"
                sx={{
                  color: 'rgba(255,255,255,0.3)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: SHAPE.sm,
                  width: 34,
                  height: 34,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: '#C7A24A',
                    borderColor: 'rgba(199, 162, 74,0.25)',
                    bgcolor: 'rgba(199, 162, 74,0.06)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                {social.icon}
              </IconButton>
            ))}
          </Stack>

          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.2)',
              fontSize: '0.7rem',
              fontStyle: 'italic',
              letterSpacing: 0.5,
            }}
          >
            "I am because we are" &mdash; Ubuntu
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default Footer
