import { Chip } from '@mui/material'
import { useAdminActions } from '@/context/AdminActionContext'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Drawer, Box, Typography, Collapse, Avatar, IconButton, Tooltip } from '@mui/material'
import { BrandLogo } from '@ubuntu-fund/ui'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import MarkEmailUnreadRoundedIcon from '@mui/icons-material/MarkEmailUnreadRounded'
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded'
import QuizRoundedIcon from '@mui/icons-material/QuizRounded'
import InfoRoundedIcon from '@mui/icons-material/InfoRounded'
import ContactMailRoundedIcon from '@mui/icons-material/ContactMailRounded'
import LayersRoundedIcon from '@mui/icons-material/LayersRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import { useAuth } from '@/context/AuthContext'
import { WASH, WASH_STRONG, ON_FILL } from '@/lib/tones'

export const DRAWER_WIDTH = 264

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

interface NavGroup {
  icon: React.ReactNode
  heading: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Operations',
    icon: <DashboardRoundedIcon />,
    items: [
      { label: 'Dashboard', path: '/', icon: <DashboardRoundedIcon /> },
      { label: 'Overview', path: '/overview', icon: <InsightsRoundedIcon /> },
      { label: 'Reports', path: '/reports', icon: <AssessmentRoundedIcon /> },
      { label: 'Audit Log', path: '/audit', icon: <HistoryEduRoundedIcon /> },
    ],
  },
  {
    heading: 'Community',
    icon: <PeopleRoundedIcon />,
    items: [
      { label: 'Campaigns', path: '/campaigns', icon: <RocketLaunchRoundedIcon /> },
      { label: 'Users', path: '/users', icon: <PeopleRoundedIcon /> },
      { label: 'Donations', path: '/donations', icon: <VolunteerActivismRoundedIcon /> },
      { label: 'Payouts', path: '/payouts', icon: <PaymentsRoundedIcon /> },
      { label: 'Subscriptions', path: '/subscriptions', icon: <WorkspacePremiumRoundedIcon /> },
    ],
  },
  {
    heading: 'Trust & Safety',
    icon: <VerifiedUserRoundedIcon />,
    items: [
      { label: 'Disputes', path: '/disputes', icon: <GavelRoundedIcon /> },
      { label: 'Verifications', path: '/verifications', icon: <VerifiedUserRoundedIcon /> },
      { label: 'KYC Review', path: '/kyc-review', icon: <BadgeRoundedIcon /> },
      {
        label: 'Contact Inbox',
        path: '/contact-submissions',
        icon: <MarkEmailUnreadRoundedIcon />,
      },
    ],
  },
  {
    heading: 'Growth',
    icon: <InsightsRoundedIcon />,
    items: [
      { label: 'Newsletter', path: '/newsletter', icon: <MarkEmailReadRoundedIcon /> },
      { label: 'Testimonials', path: '/testimonials', icon: <FormatQuoteRoundedIcon /> },
      { label: 'AI Usage', path: '/ai-usage', icon: <AutoAwesomeRoundedIcon /> },
    ],
  },
  {
    heading: 'Content',
    icon: <HistoryEduRoundedIcon />,
    items: [
      { label: 'Homepage Stats', path: '/content/stats', icon: <QueryStatsRoundedIcon /> },
      { label: 'FAQ', path: '/content/faq', icon: <QuizRoundedIcon /> },
      { label: 'About Page', path: '/content/about', icon: <InfoRoundedIcon /> },
      { label: 'Contact Details', path: '/content/contact', icon: <ContactMailRoundedIcon /> },
    ],
  },
  {
    heading: 'Platform',
    icon: <AdminPanelSettingsRoundedIcon />,
    items: [
      { label: 'Plans', path: '/plans', icon: <LayersRoundedIcon /> },
      { label: 'Coupons', path: '/coupons', icon: <LocalOfferRoundedIcon /> },
      { label: 'Affiliates', path: '/affiliates', icon: <ShareRoundedIcon /> },
      {
        label: 'Payment Providers',
        path: '/payment-providers',
        icon: <AccountBalanceRoundedIcon />,
      },
      { label: 'Roles', path: '/roles', icon: <AdminPanelSettingsRoundedIcon /> },
    ],
  },
]

function isPathActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

interface SidebarProps {
  /** Mobile temporary-drawer open state (ignored by the permanent desktop drawer). */
  mobileOpen?: boolean
  /** Close the mobile drawer — on backdrop click and after selecting a nav item. */
  onClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { items: actions } = useAdminActions()
  const countFor = (path: string) =>
    actions
      .filter((item) => item.href.split('?')[0] === path)
      .reduce((sum, item) => sum + item.count, 0)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const activeGroup = useMemo(
    () =>
      NAV_GROUPS.find((g) => g.items.some((i) => isPathActive(location.pathname, i.path)))
        ?.heading ?? NAV_GROUPS[0].heading,
    [location.pathname],
  )
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    [activeGroup]: true,
    [NAV_GROUPS[0].heading]: true,
  }))

  const toggleGroup = (heading: string) =>
    setOpenGroups((prev) => ({ ...prev, [heading]: !prev[heading] }))

  const initials = (user?.name ?? 'Admin')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const content = (
    <>
      {/* Brand */}
      <Box sx={{ px: 2.5, py: 2.25, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <BrandLogo size={38} withWordmark={false} />
        <Box>
          <Typography
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 700,
              fontSize: '1rem',
              lineHeight: 1.2,
              color: 'text.primary',
            }}
          >
            Ujimora
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#C7A24A',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontSize: '0.6rem',
              fontWeight: 700,
            }}
          >
            Admin Console
          </Typography>
        </Box>
      </Box>

      {/* Grouped nav */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, pb: 1 }}>
        {NAV_GROUPS.map((group) => {
          const open = openGroups[group.heading] ?? false
          const groupActive = group.items.some((i) => isPathActive(location.pathname, i.path))
          return (
            <Box
              key={group.heading}
              sx={{
                mb: 1,
                borderRadius: '14px',
                border: 0,
                bgcolor: '#101B15',
                boxShadow: open
                  ? 'inset 3px 3px 8px rgba(0,0,0,.34), inset -3px -3px 8px rgba(91,117,98,.10)'
                  : '3px 3px 8px rgba(0,0,0,.30), -3px -3px 8px rgba(91,117,98,.08)',
                p: 0.75,
              }}
            >
              <Box
                component="button"
                onClick={() => toggleGroup(group.heading)}
                aria-expanded={open}
                sx={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 34,
                  px: 1,
                  borderRadius: '10px',
                  '&:hover': { bgcolor: WASH },
                  '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: -2 },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      display: 'flex',
                      flexShrink: 0,
                      color: groupActive ? '#C7A24A' : '#A9925E',
                      '& svg': { fontSize: 18 },
                    }}
                  >
                    {group.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: groupActive ? '#C7A24A' : 'rgba(199, 162, 74, 0.75)',
                    }}
                  >
                    {group.heading}
                  </Typography>
                  <Box
                    sx={{
                      borderRadius: '999px',
                      bgcolor: WASH_STRONG,
                      px: 0.75,
                      py: 0.1,
                      fontSize: '0.58rem',
                      color: 'text.secondary',
                      fontWeight: 600,
                    }}
                  >
                    {group.items.length}
                  </Box>
                </Box>
                <ExpandMoreRoundedIcon
                  sx={{
                    fontSize: 18,
                    color: 'text.secondary',
                    transform: open ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </Box>

              <Collapse in={open} timeout={200}>
                <Box sx={{ mt: 0.25, pl: 3.5 }}>
                  {group.items.map((item) => {
                    const active = isPathActive(location.pathname, item.path)
                    return (
                      <Box
                        key={item.path}
                        component="button"
                        onClick={() => {
                          navigate(item.path)
                          onClose?.()
                        }}
                        aria-current={active ? 'page' : undefined}
                        sx={{
                          all: 'unset',
                          cursor: 'pointer',
                          position: 'relative',
                          // Connect each row to the group icon; stop at the final branch.
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            pointerEvents: 'none',
                            left: -11,
                            top: -2,
                            bottom: -2,
                            borderLeft: '2px solid #887B55',
                          },
                          '&:last-child::before': { bottom: '50%' },
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            pointerEvents: 'none',
                            left: -11,
                            top: 'calc(50% - 1px)',
                            width: 11,
                            borderTop: active ? '2px solid #C7A24A' : '2px solid #887B55',
                          },
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          width: '100%',
                          boxSizing: 'border-box',
                          px: 1,
                          py: 0.75,
                          mb: 0.25,
                          borderRadius: '10px',
                          bgcolor: active ? '#8FAE96' : 'transparent',
                          boxShadow: active
                            ? 'inset 3px 3px 7px rgba(14,25,22,.26), inset -3px -3px 7px rgba(255,255,255,.18)'
                            : 'none',
                          transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                          '&:hover': { bgcolor: active ? '#8FAE96' : WASH },
                          '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: -2 },
                          '&:hover .nav-tile': active ? {} : { bgcolor: '#C7A24A', color: ON_FILL },
                        }}
                      >
                        <Box
                          className="nav-tile"
                          sx={{
                            width: 30,
                            height: 30,
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            bgcolor: active ? 'rgba(14, 25, 22, 0.18)' : WASH_STRONG,
                            boxShadow: active
                              ? 'inset 2px 2px 5px rgba(0,0,0,.25)'
                              : '3px 3px 7px rgba(0,0,0,.30), -3px -3px 7px rgba(91,117,98,.10)',
                            color: active ? ON_FILL : '#C7A24A',
                            transition: 'background-color 0.15s ease, color 0.15s ease',
                            '& svg': { fontSize: 17 },
                          }}
                        >
                          {item.icon}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: active ? ON_FILL : 'text.primary',
                          }}
                        >
                          {item.label}
                        </Typography>
                        {countFor(item.path) > 0 && (
                          <Chip
                            size="small"
                            label={countFor(item.path)}
                            aria-label={`${countFor(item.path)} pending actions`}
                            sx={{ ml: 'auto' }}
                          />
                        )}
                      </Box>
                    )
                  })}
                </Box>
              </Collapse>
            </Box>
          )
        })}
      </Box>

      {/* User footer */}
      <Box
        data-tour="sidebar-user"
        sx={{
          borderTop: 0,
          boxShadow: 'inset 0 6px 12px -10px rgba(0,0,0,.9)',
          px: 1.75,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}
      >
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: '#8FAE96',
            color: ON_FILL,
            fontSize: '0.8rem',
            fontWeight: 700,
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {user?.name ?? 'Administrator'}
          </Typography>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
            {user?.role === 'admin' ? 'Administrator' : (user?.role ?? 'Team member')}
          </Typography>
        </Box>
        <Tooltip title="Sign out">
          <IconButton
            size="small"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            sx={{ color: '#C06B58', '&:hover': { bgcolor: 'rgba(192, 107, 88, 0.12)' } }}
          >
            <LogoutRoundedIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </>
  )

  const paperSx = {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box',
    bgcolor: '#101B15',
    borderRight: 0,
    boxShadow: '8px 0 22px rgba(0,0,0,0.28)',
    display: 'flex',
    flexDirection: 'column',
  } as const

  return (
    <>
      {/* Desktop: permanent rail */}
      <Drawer
        variant="permanent"
        data-tour="sidebar"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': paperSx,
        }}
      >
        {content}
      </Drawer>

      {/* Mobile: temporary overlay opened by the TopBar hamburger */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': paperSx,
        }}
      >
        {content}
      </Drawer>
    </>
  )
}
