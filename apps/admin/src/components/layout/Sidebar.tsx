import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Drawer,
  Box,
  Typography,
  Collapse,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material'
import { BrandLogo } from '@ubuntu-fund/ui'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import MarkEmailUnreadRoundedIcon from '@mui/icons-material/MarkEmailUnreadRounded'
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import LayersRoundedIcon from '@mui/icons-material/LayersRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import { useAuth } from '@/context/AuthContext'
import { HAIRLINE, WASH, WASH_STRONG, ON_FILL } from '@/lib/tones'

export const DRAWER_WIDTH = 264

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

interface NavGroup {
  heading: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Operations',
    items: [
      { label: 'Dashboard', path: '/', icon: <DashboardRoundedIcon /> },
      { label: 'Overview', path: '/overview', icon: <InsightsRoundedIcon /> },
      { label: 'Reports', path: '/reports', icon: <AssessmentRoundedIcon /> },
      { label: 'Audit Log', path: '/audit', icon: <HistoryEduRoundedIcon /> },
    ],
  },
  {
    heading: 'Community',
    items: [
      { label: 'Campaigns', path: '/campaigns', icon: <RocketLaunchRoundedIcon /> },
      { label: 'Users', path: '/users', icon: <PeopleRoundedIcon /> },
      { label: 'Donations', path: '/donations', icon: <VolunteerActivismRoundedIcon /> },
      { label: 'Subscriptions', path: '/subscriptions', icon: <WorkspacePremiumRoundedIcon /> },
    ],
  },
  {
    heading: 'Trust & Safety',
    items: [
      { label: 'Disputes', path: '/disputes', icon: <GavelRoundedIcon /> },
      { label: 'Verifications', path: '/verifications', icon: <VerifiedUserRoundedIcon /> },
      { label: 'KYC Review', path: '/kyc-review', icon: <BadgeRoundedIcon /> },
      { label: 'Contact Inbox', path: '/contact-submissions', icon: <MarkEmailUnreadRoundedIcon /> },
    ],
  },
  {
    heading: 'Growth',
    items: [
      { label: 'Newsletter', path: '/newsletter', icon: <MarkEmailReadRoundedIcon /> },
      { label: 'Testimonials', path: '/testimonials', icon: <FormatQuoteRoundedIcon /> },
      { label: 'AI Usage', path: '/ai-usage', icon: <AutoAwesomeRoundedIcon /> },
    ],
  },
  {
    heading: 'Platform',
    items: [
      { label: 'Plans', path: '/plans', icon: <LayersRoundedIcon /> },
      { label: 'Payment Providers', path: '/payment-providers', icon: <AccountBalanceRoundedIcon /> },
      { label: 'Roles', path: '/roles', icon: <AdminPanelSettingsRoundedIcon /> },
      { label: 'Invite Teammate', path: '/invite', icon: <PersonAddRoundedIcon /> },
      { label: 'Settings', path: '/settings', icon: <SettingsRoundedIcon /> },
    ],
  },
]

function isPathActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const activeGroup = useMemo(
    () =>
      NAV_GROUPS.find((g) => g.items.some((i) => isPathActive(location.pathname, i.path)))
        ?.heading ?? NAV_GROUPS[0].heading,
    [location.pathname]
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

  return (
    <Drawer
      variant="permanent"
      data-tour="sidebar"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          bgcolor: '#101B15',
          borderRight: `1px solid ${HAIRLINE}`,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
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
            UbuntuFund
          </Typography>
          <Typography variant="caption" sx={{ color: '#C7A24A', letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 700 }}>
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
                border: `1px solid ${HAIRLINE}`,
                bgcolor: 'rgba(232, 235, 227, 0.035)',
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
                <Box sx={{ mt: 0.25 }}>
                  {group.items.map((item) => {
                    const active = isPathActive(location.pathname, item.path)
                    return (
                      <Box
                        key={item.path}
                        component="button"
                        onClick={() => navigate(item.path)}
                        aria-current={active ? 'page' : undefined}
                        sx={{
                          all: 'unset',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          width: '100%',
                          boxSizing: 'border-box',
                          px: 1,
                          py: 0.75,
                          mb: 0.25,
                          borderRadius: '10px',
                          bgcolor: active ? '#8FAE96' : 'transparent',
                          boxShadow: active ? '0 2px 10px rgba(0,0,0,0.25)' : 'none',
                          transition: 'background-color 0.15s ease',
                          '&:hover': { bgcolor: active ? '#8FAE96' : WASH },
                          '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: -2 },
                          '&:hover .nav-tile': active
                            ? {}
                            : { bgcolor: '#C7A24A', color: ON_FILL },
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
                            color: active ? ON_FILL : '#C7A24A',
                            transition: 'background-color 0.15s ease, color 0.15s ease',
                            '& svg': { fontSize: 17 },
                          }}
                        >
                          {item.icon}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.855rem',
                            fontWeight: 600,
                            color: active ? ON_FILL : 'text.primary',
                          }}
                        >
                          {item.label}
                        </Typography>
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
          borderTop: `1px solid ${HAIRLINE}`,
          px: 1.75,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: '#8FAE96', color: ON_FILL, fontSize: '0.8rem', fontWeight: 700 }}>
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
    </Drawer>
  )
}
