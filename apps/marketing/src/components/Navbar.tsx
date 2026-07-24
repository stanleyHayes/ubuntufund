import { useState, useEffect, useRef } from 'react'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Drawer from '@mui/material/Drawer'
import Collapse from '@mui/material/Collapse'
import Tooltip from '@mui/material/Tooltip'
import MenuIcon from '@mui/icons-material/Menu'
import { scrollToHash } from '@/lib/scroll'
import CloseIcon from '@mui/icons-material/Close'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
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

const CREAM = '#F5F2EA'
const GOLD = '#C7A24A'
const GOLD_LIGHT = '#DCC07E'
const FOREST_DARK = '#1C261D'

const dropIn = keyframes`
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`

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

function isActive(href: string, pathname: string): boolean {
  const [path, hash] = href.split('#')
  if (hash) return false
  return pathname === (path || '/')
}

function isMenuActive(menu: NavMenu, pathname: string): boolean {
  return menu.items.some((item) => isActive(item.href, pathname))
}

// ── Desktop dropdown: uppercase trigger on the dark bar, gold active underline;
//    the panel floats as a light card. ────────────────────────────────────────
function MegaDropdown({
  menu,
  open,
  onOpen,
  onClose,
  pathname,
  onNavigate,
}: {
  menu: NavMenu
  open: boolean
  onOpen: () => void
  onClose: () => void
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
      <Box
        onClick={handleEnter}
        role="button"
        tabIndex={0}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 0.35,
          height: 44,
          px: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Typography
          component="span"
          sx={{
            fontFamily: '"Outfit", sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            fontSize: '0.78rem',
            fontWeight: menuActive || open ? 700 : 600,
            color: menuActive || open ? CREAM : 'rgba(245, 242, 234, 0.72)',
            transition: 'color 160ms ease',
            lineHeight: 1,
          }}
        >
          {menu.label}
        </Typography>
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 15,
            color: 'rgba(245, 242, 234, 0.5)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: 6,
            left: 12,
            right: 20,
            height: 2,
            borderRadius: 2,
            bgcolor: GOLD,
            transformOrigin: 'center',
            transform: menuActive || open ? 'scaleX(1)' : 'scaleX(0)',
            transition: 'transform 180ms ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />
      </Box>

      {open && (
        <Box sx={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 1400, pt: '10px' }}>
          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: SHAPE.card,
              border: '1px solid rgba(0,0,0,0.08)',
              minWidth: 340,
              maxWidth: 400,
              overflow: 'hidden',
              animation: `${dropIn} 0.18s ease both`,
            }}
          >
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
                        '& .dd-icon': { bgcolor: '#2E3D2F', color: '#fff' },
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
                        transition: 'all 0.2s ease',
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
        <Typography sx={{ fontWeight: active ? 700 : 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? '#1C261D' : '#1a1a1a' }}>
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

function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()

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
      {/* Solid forest bar (design language #2), gold seam, no glass/shadow */}
      <Box
        component="nav"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          bgcolor: FOREST_DARK,
          boxShadow: 'inset 0 -2px 0 rgba(199, 162, 74, 0.45)',
        }}
      >
        <Box
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            px: { xs: 2, md: 4 },
            height: { xs: 62, md: 74 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          {/* Logo + tagline */}
          <Box
            onClick={() => handleNav('/')}
            sx={{ cursor: 'pointer', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0.35 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="img" src="/favicon.svg" alt="UbuntuFund" sx={{ width: 32, height: 32, display: 'block' }} />
              <Typography
                sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, fontSize: '1.15rem', lineHeight: 1, color: CREAM, whiteSpace: 'nowrap' }}
              >
                Ubuntu<Box component="span" sx={{ color: GOLD }}>Fund</Box>
              </Typography>
            </Box>
            <Typography
              sx={{
                pl: '42px',
                fontFamily: '"Outfit", sans-serif',
                fontSize: '0.56rem',
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(245, 242, 234, 0.5)',
              }}
            >
              One chain · Many hands
            </Typography>
          </Box>

          {/* Desktop nav */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.25 }}>
            {menus.map((menu) => (
              <MegaDropdown
                key={menu.label}
                menu={menu}
                open={openMenu === menu.label}
                onOpen={() => setOpenMenu(menu.label)}
                onClose={() => setOpenMenu((prev) => (prev === menu.label ? null : prev))}
                pathname={pathname}
                onNavigate={handleNav}
              />
            ))}
          </Box>

          {/* Right cluster: search + outlined CTA */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <Tooltip title="Explore campaigns">
              <IconButton
                aria-label="Explore campaigns"
                href={`${WEB_APP_URL}/explore`}
                sx={{
                  width: 40,
                  height: 40,
                  color: CREAM,
                  border: '1px solid rgba(245, 242, 234, 0.20)',
                  '&:hover': { bgcolor: 'rgba(245, 242, 234, 0.08)', borderColor: 'rgba(245, 242, 234, 0.35)' },
                }}
              >
                <SearchRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Button
              href={`${WEB_APP_URL}/register`}
              endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 700,
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderRadius: '999px',
                px: 2.5,
                py: 0.85,
                color: GOLD_LIGHT,
                border: '1.5px solid rgba(199, 162, 74, 0.55)',
                transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease',
                '&:hover': { bgcolor: GOLD, color: FOREST_DARK, borderColor: GOLD },
              }}
            >
              Get Started
            </Button>
          </Box>

          {/* Mobile hamburger */}
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{
              display: { xs: 'flex', md: 'none' },
              width: 40,
              height: 40,
              color: CREAM,
              border: '1px solid rgba(245, 242, 234, 0.18)',
            }}
          >
            <MenuIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 320, bgcolor: '#F2EFEA' } } }}
      >
        <Box sx={{ px: 2.5, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="img" src="/favicon.svg" alt="UbuntuFund" sx={{ width: 30, height: 30 }} />
            <Typography sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 900, fontSize: '1.05rem' }}>
              Ubuntu<Box component="span" sx={{ color: GOLD }}>Fund</Box>
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
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
            fullWidth
            sx={{
              borderRadius: '999px',
              fontWeight: 700,
              fontFamily: '"Outfit", sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '0.8rem',
              py: 1.3,
              color: FOREST_DARK,
              bgcolor: GOLD,
              '&:hover': { bgcolor: GOLD_LIGHT },
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
