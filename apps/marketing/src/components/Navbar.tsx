import { useState, useEffect, useRef } from 'react'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Drawer from '@mui/material/Drawer'
import Collapse from '@mui/material/Collapse'
import MenuIcon from '@mui/icons-material/Menu'
import { scrollToHash } from '@/lib/scroll'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward'
// Menu icons
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TimelineIcon from '@mui/icons-material/Timeline'
import GroupsIcon from '@mui/icons-material/Groups'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import ShieldIcon from '@mui/icons-material/Shield'
import DiamondIcon from '@mui/icons-material/Diamond'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import PublicIcon from '@mui/icons-material/Public'
import ForumIcon from '@mui/icons-material/Forum'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import GavelIcon from '@mui/icons-material/Gavel'
import LockIcon from '@mui/icons-material/Lock'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import { useLocation, useNavigate } from 'react-router-dom'
import { keyframes } from '@emotion/react'
import { SHAPE } from '@ubuntu-fund/ui'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const dropIn = keyframes`
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ---------------------------------------------------------------------------
// Menu data
// ---------------------------------------------------------------------------

interface MenuItem {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  anchor?: boolean
}

interface NavMenu {
  label: string
  items: MenuItem[]
}

const menus: NavMenu[] = [
  {
    label: 'Product',
    items: [
      { icon: <AutoAwesomeIcon />, title: 'Features', description: 'Trust system, escrow, and verification', href: '/#features', anchor: true },
      { icon: <TimelineIcon />, title: 'How It Works', description: 'Three-step process from creation to impact', href: '/#how-it-works', anchor: true },
      { icon: <VolunteerActivismIcon />, title: 'Campaign Types', description: 'Medical, education, community, and more', href: '/#campaign-types', anchor: true },
      { icon: <ShieldIcon />, title: 'Trust System', description: 'Multi-level verification and scoring', href: '/#features', anchor: true },
    ],
  },
  {
    label: 'Company',
    items: [
      { icon: <PublicIcon />, title: 'About Us', description: 'Our mission and the team behind UbuntuFund', href: '/about' },
      { icon: <AutoStoriesIcon />, title: 'Blog', description: 'Stories, updates, and insights from Ghana', href: '/blog' },
      { icon: <DiamondIcon />, title: 'Pricing', description: 'Transparent fees — free for personal campaigns', href: '/pricing' },
      { icon: <GroupsIcon />, title: 'For Organizations', description: 'Enterprise tools for institutions and NGOs', href: '/for-organizations' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { icon: <SupportAgentIcon />, title: 'Help Center', description: 'Guides, FAQs, and getting started', href: '/help' },
      { icon: <ForumIcon />, title: 'Contact', description: 'Reach our team for support or partnerships', href: '/contact' },
      { icon: <GavelIcon />, title: 'Terms of Service', description: 'Rules that govern the platform', href: '/terms' },
      { icon: <LockIcon />, title: 'Privacy Policy', description: 'How we protect your information', href: '/privacy' },
      { icon: <SyncAltIcon />, title: 'Refund Policy', description: 'Donor protections when campaigns change', href: '/refund-policy' },
    ],
  },
]

const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:8200'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isActive(href: string, pathname: string): boolean {
  const [path, hash] = href.split('#')
  // Anchor-only links (e.g. /#features) — don't count as "active" for nav highlighting
  // since they're sections on the landing page, not distinct pages
  if (hash) return false
  return pathname === (path || '/')
}

function isMenuActive(menu: NavMenu, pathname: string): boolean {
  return menu.items.some((item) => isActive(item.href, pathname))
}

// ---------------------------------------------------------------------------
// MegaDropdown
// ---------------------------------------------------------------------------

function MegaDropdown({
  menu,
  open,
  onOpen,
  onClose,
  scrolled,
  pathname,
  onNavigate,
}: {
  menu: NavMenu
  open: boolean
  onOpen: () => void
  onClose: () => void
  scrolled: boolean
  pathname: string
  onNavigate: (href: string) => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const menuActive = isMenuActive(menu, pathname)

  function handleEnter() {
    clearTimeout(timerRef.current)
    onOpen()
  }
  function handleLeave() {
    timerRef.current = setTimeout(onClose, 180)
  }
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <Box onMouseEnter={handleEnter} onMouseLeave={handleLeave} sx={{ position: 'relative' }}>
      {/* Trigger */}
      <Box
        onClick={handleEnter}
        role="button"
        tabIndex={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          height: 36,
          px: 1.25,
          borderRadius: SHAPE.sm,
          cursor: 'pointer',
          userSelect: 'none',
          position: 'relative',
          transition: 'all 0.2s ease',
          bgcolor: open
            ? (scrolled ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.1)')
            : 'transparent',
          '&:hover': {
            bgcolor: scrolled ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.1)',
          },
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: '0.8rem',
            fontWeight: menuActive ? 700 : 500,
            color: scrolled
              ? (menuActive ? '#1C261D' : '#1a1a1a')
              : (menuActive ? '#DCC07E' : 'rgba(255,255,255,0.9)'),
            transition: 'color 0.3s',
            lineHeight: 1,
          }}
        >
          {menu.label}
        </Typography>
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 14,
            color: scrolled ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
        {/* Active indicator */}
        {menuActive && !open && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 2,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 16,
              height: 2.5,
              borderRadius: 2,
              bgcolor: scrolled ? '#2E3D2F' : '#C7A24A',
            }}
          />
        )}
      </Box>

      {/* Panel */}
      {open && (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1400,
            pt: '12px', // spacing via padding so hover area is continuous
          }}
        >
          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: SHAPE.card,
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.04)',
              minWidth: 340,
              maxWidth: 400,
              overflow: 'hidden',
              animation: `${dropIn} 0.18s ease both`,
            }}
          >
            {/* Section label */}
            <Box sx={{ px: 2, pt: 1.5, pb: 0.75 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999' }}>
                {menu.label}
              </Typography>
            </Box>

            <Box sx={{ px: 0.75, pb: 0.75 }}>
              {menu.items.map((item) => {
                const active = isActive(item.href, pathname)
                return (
                  <Box
                    key={item.title}
                    onClick={() => { onNavigate(item.href); onClose() }}
                    sx={{
                      display: 'flex',
                      gap: 1.25,
                      px: 1.25,
                      py: 1,
                      borderRadius: SHAPE.sm,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      bgcolor: active ? 'rgba(46, 61, 47,0.05)' : 'transparent',
                      '&:hover': {
                        bgcolor: active ? 'rgba(46, 61, 47,0.08)' : '#f8f8f5',
                        '& .dd-icon': {
                          bgcolor: '#2E3D2F',
                          color: '#fff',
                          transform: 'rotate(-4deg) scale(1.06)',
                        },
                        '& .dd-arrow': { opacity: 1, transform: 'translate(0,0)' },
                      },
                    }}
                  >
                    <Box
                      className="dd-icon"
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: SHAPE.sm,
                        bgcolor: active ? '#2E3D2F' : '#f0f5f0',
                        color: active ? '#fff' : '#2E3D2F',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
                        '& .MuiSvgIcon-root': { fontSize: 17 },
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                      <Box>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: active ? 700 : 600, color: active ? '#1C261D' : '#1a1a1a', lineHeight: 1.2 }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.68rem', color: '#888', lineHeight: 1.35, mt: 0.1 }}>
                          {item.description}
                        </Typography>
                      </Box>
                    </Box>
                    <ArrowOutwardIcon
                      className="dd-arrow"
                      sx={{
                        fontSize: 12,
                        color: active ? '#2E3D2F' : '#bbb',
                        opacity: active ? 0.6 : 0,
                        transform: 'translate(-3px, 3px)',
                        transition: 'all 0.15s ease',
                        alignSelf: 'center',
                        flexShrink: 0,
                      }}
                    />
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Mobile
// ---------------------------------------------------------------------------

function MobileMenuGroup({ menu, pathname, onNavigate }: { menu: NavMenu; pathname: string; onNavigate: (href: string) => void }) {
  const [open, setOpen] = useState(false)
  const active = isMenuActive(menu, pathname)

  return (
    <Box>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 2.5, py: 1.5, cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' },
        }}
      >
        <Typography sx={{ fontWeight: active ? 700 : 500, fontSize: '0.95rem', color: active ? '#1C261D' : '#1a1a1a' }}>
          {menu.label}
        </Typography>
        <ExpandMoreIcon sx={{ fontSize: 18, color: '#999', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </Box>
      <Collapse in={open}>
        <Box sx={{ pb: 1 }}>
          {menu.items.map((item) => {
            const itemActive = isActive(item.href, pathname)
            return (
              <Box
                key={item.title}
                onClick={() => onNavigate(item.href)}
                sx={{
                  display: 'flex', gap: 1.5, px: 3, py: 1.25, cursor: 'pointer',
                  bgcolor: itemActive ? 'rgba(46, 61, 47, 0.08)' : 'transparent',
                  '&:hover': { bgcolor: itemActive ? 'rgba(46, 61, 47, 0.08)' : 'rgba(0,0,0,0.02)' },
                }}
              >
                <Box sx={{
                  width: 30, height: 30, borderRadius: SHAPE.sm,
                  bgcolor: itemActive ? '#2E3D2F' : '#f0f5f0',
                  color: itemActive ? '#fff' : '#2E3D2F',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  '& .MuiSvgIcon-root': { fontSize: 15 },
                }}>
                  {item.icon}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: itemActive ? 700 : 500, color: itemActive ? '#1C261D' : '#1a1a1a' }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.66rem', color: '#999', lineHeight: 1.3 }}>
                    {item.description}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      </Collapse>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setOpenMenu(null), 0)
    return () => clearTimeout(id)
  }, [pathname])

  function handleNav(href: string) {
    setDrawerOpen(false)
    setOpenMenu(null)
    const [path, hash] = href.split('#')
    const target = path || '/'
    if (hash && pathname === target) {
      const el = document.getElementById(hash)
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return }
    }
    navigate(href)
    if (hash) scrollToHash(hash)
  }

  return (
    <>
      {/* ================================================================= */}
      {/*  NAVBAR — morphs from full-width to floating island on scroll     */}
      {/* ================================================================= */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          display: 'flex',
          justifyContent: 'center',
          px: scrolled ? 2 : 0,
          pt: scrolled ? 1.25 : 0,
          transition: 'padding 0.55s cubic-bezier(0.33, 1, 0.68, 1)',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            pointerEvents: 'auto',
            width: scrolled ? 'min(820px, calc(100% - 32px))' : '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 1, md: 2 },

            // ── Shape ──
            px: scrolled ? { xs: 2, md: 2.5 } : { xs: 2, md: 4 },
            py: scrolled ? 0.7 : 1,
            borderRadius: scrolled ? SHAPE.card : 0,

            // ── Glass ──
            bgcolor: scrolled
              ? 'rgba(255,255,255,0.9)'
              : 'rgba(0,0,0,0.06)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',

            // ── Border (use outline to avoid layout shifts) ──
            outline: scrolled
              ? '1px solid rgba(0,0,0,0.06)'
              : '1px solid transparent',

            // ── Shadow ──
            boxShadow: scrolled
              ? '0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)'
              : 'none',

            // ── Smooth transition on individual properties ──
            transition: `
              width 0.55s cubic-bezier(0.33, 1, 0.68, 1),
              padding 0.55s cubic-bezier(0.33, 1, 0.68, 1),
              border-radius 0.55s cubic-bezier(0.33, 1, 0.68, 1),
              background-color 0.4s ease,
              box-shadow 0.4s ease,
              outline-color 0.4s ease
            `,
          }}
        >
          {/* ─── Logo ─── */}
          <Box
            onClick={() => handleNav('/')}
            sx={{
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              transition: 'transform 0.2s ease, opacity 0.2s ease',
              '&:hover': { transform: 'scale(1.03)', opacity: 0.9 },
              '&:active': { transform: 'scale(0.97)' },
            }}
          >
            <Box
              component="img"
              src="/favicon.svg"
              alt="UbuntuFund"
              sx={{
                width: scrolled ? 32 : 36,
                height: scrolled ? 32 : 36,
                transition: 'all 0.5s cubic-bezier(0.33,1,0.68,1)',
                display: 'block',
              }}
            />
            <Typography
              sx={{
                fontFamily: '"TT Squares", "Inter", sans-serif',
                fontWeight: 800,
                fontSize: scrolled ? '1.05rem' : '1.15rem',
                lineHeight: 1,
                color: scrolled ? '#1C261D' : '#fff',
                transition: 'all 0.4s ease',
                whiteSpace: 'nowrap',
              }}
            >
              Ubuntu
              <Box
                component="span"
                sx={{ color: '#C7A24A' }}
              >
                Fund
              </Box>
            </Typography>
          </Box>

          {/* ─── Desktop nav links ─── */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            {menus.map((menu) => (
              <MegaDropdown
                key={menu.label}
                menu={menu}
                open={openMenu === menu.label}
                onOpen={() => setOpenMenu(menu.label)}
                // Close only if this menu is still the open one — otherwise a
                // stale close timer from menu A dismisses freshly opened menu B.
                onClose={() => setOpenMenu((prev) => (prev === menu.label ? null : prev))}
                scrolled={scrolled}
                pathname={pathname}
                onNavigate={handleNav}
              />
            ))}
          </Box>

          {/* ─── CTA ─── */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0 }}>
            <Button
              href={`${WEB_APP_URL}/register`}
              size="small"
              sx={{
                fontWeight: 700,
                fontFamily: '"TT Squares", sans-serif',
                fontSize: '0.78rem',
                textTransform: 'none',
                borderRadius: SHAPE.sm,
                px: 2.5,
                py: 0.7,
                color: '#1C261D',
                background: 'linear-gradient(135deg, #C7A24A, #A07E33)',
                boxShadow: scrolled
                  ? '0 2px 8px rgba(199, 162, 74,0.25)'
                  : '0 2px 12px rgba(199, 162, 74,0.3)',
                transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #DCC07E, #C7A24A)',
                  boxShadow: '0 2px 8px rgba(199, 162, 74,0.3)',
                },
              }}
            >
              Get Started
            </Button>
          </Box>

          {/* ─── Mobile hamburger ─── */}
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{
              display: { xs: 'flex', md: 'none' },
              width: 36,
              height: 36,
              borderRadius: SHAPE.sm,
              color: scrolled ? '#1a1a1a' : '#fff',
              border: scrolled ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.15)',
              ml: 'auto',
            }}
          >
            <MenuIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* ================================================================= */}
      {/*  Mobile Drawer                                                     */}
      {/* ================================================================= */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 320, bgcolor: '#F2EFEA' } }}
      >
        <Box sx={{ px: 2.5, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="img" src="/favicon.svg" alt="UbuntuFund" sx={{ width: 30, height: 30 }} />
            <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 900, fontSize: '1.05rem' }}>
              Ubuntu<Box component="span" sx={{ color: '#C7A24A' }}>Fund</Box>
            </Typography>
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)} size="small" sx={{ width: 30, height: 30, borderRadius: SHAPE.sm, border: '1px solid rgba(0,0,0,0.08)' }}>
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
        <Box sx={{ height: '1px', bgcolor: 'rgba(0,0,0,0.06)' }} />
        <Box sx={{ py: 1, flex: 1, overflow: 'auto' }}>
          {menus.map((m) => <MobileMenuGroup key={m.label} menu={m} pathname={pathname} onNavigate={handleNav} />)}
        </Box>
        <Box sx={{ height: '1px', bgcolor: 'rgba(0,0,0,0.06)', mx: 2.5 }} />
        <Box sx={{ p: 2.5 }}>
          <Button
            href={`${WEB_APP_URL}/register`}
            variant="contained"
            fullWidth
            sx={{
              borderRadius: SHAPE.sm,
              fontWeight: 700,
              fontFamily: '"TT Squares", sans-serif',
              textTransform: 'none',
              py: 1.3,
              background: 'linear-gradient(135deg, #C7A24A, #A07E33)',
              color: '#1C261D',
              boxShadow: '0 4px 14px rgba(199, 162, 74,0.25)',
              '&:hover': { background: 'linear-gradient(135deg, #DCC07E, #C7A24A)' },
            }}
          >
            Get Started
          </Button>
        </Box>
      </Drawer>
    </>
  )
}

export default Navbar
