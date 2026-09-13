import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, FormControlLabel, Switch, Tab, Tabs, Typography } from '@mui/material'
import { MfaSettings, ThemeStylePicker } from '@ubuntu-fund/ui'
import { Action, Resource } from '@ubuntu-fund/types'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import ExportMenu from '@/components/ExportMenu'
import PageHeader from '@/components/PageHeader'
import { AutomaticPayoutSettings } from '@/components/AutomaticPayoutSettings'
import { EarlyCashoutSettings } from '@/components/EarlyCashoutSettings'
import { ReferralDiscountSettings } from '@/components/ReferralDiscountSettings'
import { CampaignReviewSettings } from '@/components/CampaignReviewSettings'
import { ActivityAlertSettings } from '@/components/ActivityAlertSettings'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { useColorMode } from '@/context/ColorModeContext'
import { useAuth } from '@/context/AuthContext'
import { raisedSurface } from '@/lib/surfaces'
import { api } from '@/lib/api'
import { exportTable } from '@/lib/exports/report'

const sections = [
  {
    id: 'payments',
    label: 'Payments',
    icon: <PaymentsRoundedIcon />,
    description: 'Cashout fees and automatic payout limits. Save each policy separately.',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: <CampaignRoundedIcon />,
    description: 'Publication review rules, fundraising tiers and staff review emails.',
  },
  {
    id: 'referrals',
    label: 'Referrals',
    icon: <PeopleRoundedIcon />,
    description: 'The first-subscription discount for referred customers.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <NotificationsRoundedIcon />,
    description: 'Your personal activity alerts and email choices. Each choice saves immediately.',
  },
  {
    id: 'security',
    label: 'Security',
    icon: <SecurityRoundedIcon />,
    description: 'Optional extra protection for your own administrator account.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: <PaletteRoundedIcon />,
    description: 'Make this console comfortable for you. Preferences apply to this browser.',
  },
]

function Panel({ children }: { children: ReactNode }) {
  return <Box sx={{ ...raisedSurface, p: { xs: 2, sm: 3 }, mt: 3 }}>{children}</Box>
}

export default function SettingsPage() {
  const { user } = useAuth()
  return <SettingsContent key={user?.id} />
}

function SettingsContent() {
  const { can } = useAdminPermissions()
  const canEdit = can(Resource.SETTINGS, Action.UPDATE)
  const { user, replaceTokens } = useAuth()
  const { darkMode, setDarkMode, skin, setSkin } = useColorMode()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const active = sections.find((section) => section.id === requested)?.id ?? 'payments'
  const [visited, setVisited] = useState<string[]>([active])
  const [appearanceNotice, setAppearanceNotice] = useState('')
  const panels: Record<string, ReactNode> = {
    payments: (
      <>
        <EarlyCashoutSettings canEdit={canEdit} />
        <AutomaticPayoutSettings canEdit={canEdit} />
      </>
    ),
    campaigns: <CampaignReviewSettings canEdit={canEdit} />,
    referrals: <ReferralDiscountSettings canEdit={canEdit} />,
    notifications: (
      <Panel>
        <ActivityAlertSettings />
      </Panel>
    ),
    security: (
      <Panel>
        <MfaSettings client={api} onTokens={(tokens) => replaceTokens(tokens, user?.id ?? '')} />
        <Button component={Link} to="/profile" sx={{ mt: 2 }}>
          Manage profile and password
        </Button>
      </Panel>
    ),
    appearance: (
      <Panel>
        <Typography variant="h6">Console appearance</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Choose a color mode and surface style. Changes apply immediately.
        </Typography>
        <FormControlLabel
          label="Dark mode"
          control={
            <Switch
              checked={darkMode}
              onChange={(_, value) => {
                setDarkMode(value)
                setAppearanceNotice('Color mode updated.')
              }}
            />
          }
        />
        <ThemeStylePicker
          value={skin}
          onChange={(value) => {
            setSkin(value)
            setAppearanceNotice('Surface style updated.')
          }}
        />
        {appearanceNotice && (
          <Alert severity="success" role="status" sx={{ mt: 2 }}>
            {appearanceNotice}
          </Alert>
        )}
      </Panel>
    ),
  }
  return (
    <Box sx={{ minWidth: 0 }}>
      <PageHeader
        eyebrow="Platform & account"
        title="Settings"
        lede="Focused controls for platform policies and your personal console preferences."
        icon={<SettingsRoundedIcon />}
        actions={
          <>
            <Button component={Link} to="/plans" startIcon={<OpenInNewRoundedIcon />}>
              Manage Plans
            </Button>
            <ExportMenu
              title="Persisted settings"
              getReport={async (progress) => {
                const [config, automatic] = await Promise.all([
                  api.get<{ resolved: Record<string, string | number> }>(
                    '/admin/commercial-config',
                    { signal: progress.signal },
                  ),
                  api.get<{
                    enabled: boolean
                    maxAmount: number
                    dailyOwnerLimit: number
                    dailyPlatformLimit: number
                    reviewMaxAgeDays: number
                    mobileMoneyMaxAmount: number
                    mobileMoneyReviewMaxAgeHours: number
                  }>('/admin/automatic-payouts', { signal: progress.signal }),
                ])
                const keys = [
                  'earlyFeePercent',
                  'affiliate.referralDiscountPercent',
                  'campaigns.autoApproveMaxTier',
                  'campaigns.tierThreshold1',
                  'campaigns.tierThreshold2',
                  'campaigns.tierThreshold3',
                  'campaigns.tierThreshold4',
                  'alerts.reviewEmail',
                ]
                return {
                  title: 'Persisted platform settings',
                  filters: [
                    'Effective server configuration',
                    'Local preferences and unsaved controls excluded',
                  ],
                  tables: [
                    exportTable('Commercial configuration', keys, {
                      Setting: (key) => key,
                      Value: (key) => config.resolved[key],
                    }),
                    exportTable('Automatic payouts', [automatic], {
                      Enabled: (r) => r.enabled,
                      'Maximum amount (GHS)': (r) => r.maxAmount,
                      'Daily owner limit (GHS)': (r) => r.dailyOwnerLimit,
                      'Daily platform limit (GHS)': (r) => r.dailyPlatformLimit,
                      'Review age (days)': (r) => r.reviewMaxAgeDays,
                      'Mobile money maximum (GHS)': (r) => r.mobileMoneyMaxAmount,
                      'Mobile money review age (hours)': (r) => r.mobileMoneyReviewMaxAgeHours,
                    }),
                  ],
                }
              }}
            />
          </>
        }
      />
      <Box sx={{ ...raisedSurface, p: 1 }}>
        <Tabs
          value={active}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Settings categories"
          onChange={(_, value: string) => {
            setVisited((previous) => [...new Set([...previous, active, value])])
            setParams(
              (previous) => {
                previous.set('tab', value)
                return previous
              },
              { replace: true },
            )
          }}
        >
          {sections.map((section) => (
            <Tab
              key={section.id}
              id={`settings-tab-${section.id}`}
              aria-controls={`settings-panel-${section.id}`}
              value={section.id}
              label={section.label}
              icon={section.icon}
              iconPosition="start"
              sx={{ minHeight: 56, textTransform: 'none', fontWeight: 600 }}
            />
          ))}
        </Tabs>
      </Box>
      {sections.map((section) => (
        <Box
          key={section.id}
          role="tabpanel"
          id={`settings-panel-${section.id}`}
          aria-labelledby={`settings-tab-${section.id}`}
          hidden={active !== section.id}
          tabIndex={0}
        >
          {(visited.includes(section.id) || active === section.id) && (
            <>
              <Box sx={{ position: 'relative', overflow: 'hidden', mt: 3, px: 1, py: 2 }}>
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    right: 12,
                    top: -12,
                    opacity: 0.06,
                    pointerEvents: 'none',
                    '& svg': { fontSize: 120 },
                  }}
                >
                  {section.icon}
                </Box>
                <Typography variant="h5">{section.label}</Typography>
                <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>
                  {section.description}
                </Typography>
              </Box>
              {!canEdit && ['payments', 'campaigns', 'referrals'].includes(section.id) && (
                <Alert severity="info">Platform policies are read-only for your role.</Alert>
              )}
              {panels[section.id]}
            </>
          )}
        </Box>
      ))}
    </Box>
  )
}
