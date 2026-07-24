import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Slider from '@mui/material/Slider'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { keyframes, alpha } from '@mui/material/styles'
import { Resource, Action, SUBSCRIPTION_PLANS, SubscriptionTier } from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Types ───────────────────────────────────────────────────────────────────

interface SettingRowProps {
  label: string
  description?: string
  children: React.ReactNode
}

// ─── Setting Row ─────────────────────────────────────────────────────────────

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 3,
        py: 2,
        px: 3,
        transition: 'background 0.2s ease',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: 'text.primary' }}>
          {label}
        </Typography>
        {description && (
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Box sx={{ flexShrink: 0 }}>{children}</Box>
    </Box>
  )
}

// ─── Section Card ────────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  color,
  badge,
  children,
  delay = 0,
}: {
  icon: React.ReactNode
  title: string
  color: string
  badge?: React.ReactNode
  children: React.ReactNode
  delay?: number
}) {
  return (
    <Card
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
        animation: `${fadeSlide} 0.4s ease ${delay}s both`,
        transition: 'border-color 0.3s ease',
        '&:hover': { borderColor: `${color}40` },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '20%',
            bottom: '20%',
            width: 3,
            borderRadius: '0 4px 4px 0',
            bgcolor: color,
          },
        }}
      >
        <Box sx={{ color, display: 'flex', '& svg': { fontSize: 22 } }}>{icon}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', flex: 1 }}>{title}</Typography>
        {badge}
      </Box>
      <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' } }}>
        {children}
      </Box>
    </Card>
  )
}

// ─── Number Input ────────────────────────────────────────────────────────────

function NumberInput({ value, onChange, suffix }: { value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type="number"
      size="small"
      slotProps={{
        input: {
          endAdornment: suffix ? (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 0.5, whiteSpace: 'nowrap' }}>{suffix}</Typography>
          ) : undefined,
        },
      }}
      sx={{
        width: 120,
        '& .MuiOutlinedInput-root': {
          bgcolor: 'rgba(255,255,255,0.03)',
          '& fieldset': { borderColor: 'divider' },
          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
          '&.Mui-focused fieldset': { borderColor: 'primary.main' },
        },
        '& .MuiOutlinedInput-input': { color: 'text.primary', textAlign: 'right' },
      }}
    />
  )
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      checked={checked}
      onChange={(_, v) => onChange(v)}
      sx={{
        '& .MuiSwitch-switchBase.Mui-checked': { color: '#5E8F72' },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#5E8F72' },
      }}
    />
  )
}

// ─── Tier colors ─────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  free: '#78909C',
  starter: '#74909A',
  pro: '#AB47BC',
  enterprise: '#C7A24A',
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { can } = useAdminPermissions()
  const canEdit = can(Resource.SETTINGS, Action.UPDATE)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [snackOpen, setSnackOpen] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Global payment fees (not plan-dependent)
  const [processingFee, setProcessingFee] = useState('2.9')
  const [fixedFee, setFixedFee] = useState('0.30')
  const [withdrawalFee, setWithdrawalFee] = useState('1.5')

  // Global campaign limits (absolute platform maximums)
  const [minDonation, setMinDonation] = useState('1')
  const [maxDuration, setMaxDuration] = useState('90')

  // Verification
  const [emailRequired, setEmailRequired] = useState(true)
  const [phoneRequired, setPhoneRequired] = useState(true)
  const [nationalIdRequired, setNationalIdRequired] = useState(true)
  const [institutionalRequired, setInstitutionalRequired] = useState(false)
  const [autoApprove, setAutoApprove] = useState(true)
  const [autoApproveScore, setAutoApproveScore] = useState(70)

  // Notifications
  const [notifCampaigns, setNotifCampaigns] = useState(true)
  const [notifDisputes, setNotifDisputes] = useState(true)
  const [notifLargeDonations, setNotifLargeDonations] = useState(true)
  const [notifDaily, setNotifDaily] = useState(false)
  const [notifWeekly, setNotifWeekly] = useState(true)
  const [notifFraud, setNotifFraud] = useState(true)

  // Security
  const [twoFactor, setTwoFactor] = useState(true)
  const [ipWhitelist, setIpWhitelist] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState('30')
  const [loginAlerts, setLoginAlerts] = useState(true)

  // Appearance
  const [darkMode, setDarkMode] = useState(true)
  const [compactMode, setCompactMode] = useState(false)
  const [showAnimations, setShowAnimations] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  function track<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setHasChanges(true) }
  }

  function handleSave() {
    setSnackOpen(true)
    setHasChanges(false)
  }

  function handleReset() {
    setProcessingFee('2.9'); setFixedFee('0.30'); setWithdrawalFee('1.5')
    setMinDonation('1'); setMaxDuration('90')
    setHasChanges(false)
  }

  const plans = Object.values(SUBSCRIPTION_PLANS)

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid', borderColor: 'divider', borderTopColor: 'primary.main', animation: 'spin 0.8s linear infinite', mx: 'auto', mb: 2, '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
          <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Loading settings...</Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, animation: `${fadeSlide} 0.3s ease both` }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: 'text.primary', mb: 0.5 }}>
            Platform Settings
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            Configure global fees, verification, notifications, and security
          </Typography>
        </Box>
        {canEdit && (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Tooltip title="Reset to defaults">
              <IconButton
                onClick={handleReset}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, '&:hover': { borderColor: 'warning.main', color: 'warning.main' } }}
              >
                <RestoreRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={handleSave}
              disabled={!hasChanges}
              sx={{
                borderRadius: 2,
                px: 3,
                fontWeight: 700,
                textTransform: 'none',
                transition: 'box-shadow 200ms ease',
                boxShadow: hasChanges ? '0 0 0 3px rgba(143,174,150,0.35)' : 'none',
              }}
            >
              Save Changes
            </Button>
          </Box>
        )}
      </Box>

      {!canEdit && (
        <Alert
          severity="warning"
          sx={{
            mb: 3,
            bgcolor: 'rgba(211,169,92,0.08)',
            border: '1px solid rgba(211,169,92,0.2)',
            borderRadius: 2,
            animation: `${fadeSlide} 0.3s ease both`,
            '& .MuiAlert-icon': { color: 'warning.main' },
          }}
        >
          You are viewing settings in read-only mode. Contact an administrator to make changes.
        </Alert>
      )}

      {hasChanges && canEdit && (
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon />}
          sx={{
            mb: 3,
            bgcolor: 'rgba(116,144,154,0.08)',
            border: '1px solid rgba(116,144,154,0.2)',
            borderRadius: 2,
            animation: `${fadeSlide} 0.3s ease both`,
            '& .MuiAlert-icon': { color: 'info.main' },
          }}
        >
          You have unsaved changes. Click &quot;Save Changes&quot; to apply.
        </Alert>
      )}

      <Grid container spacing={3} sx={!canEdit ? { pointerEvents: 'none', opacity: 0.6 } : undefined}>

        {/* ─── Platform Fees by Subscription Tier ─── */}
        <Grid size={{ xs: 12 }}>
          <SectionCard
            icon={<MonetizationOnRoundedIcon />}
            title="Platform Fees by Subscription Tier"
            color="#5E8F72"
            delay={0}
            badge={
              <Button
                size="small"
                endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '16px !important' }} />}
                onClick={() => navigate('/plans')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  color: '#5E8F72',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': { bgcolor: alpha('#5E8F72', 0.08) },
                }}
              >
                Manage Plans
              </Button>
            }
          >
            <Box sx={{ px: 3, py: 2.5 }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2.5 }}>
                Platform fees are determined by the user&apos;s subscription tier. To modify these fees, go to Manage Plans.
              </Typography>
              <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha('#fff', 0.03) }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', borderColor: 'divider', py: 1.5 }}>Tier</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', borderColor: 'divider', py: 1.5 }}>Platform Fee</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', borderColor: 'divider', py: 1.5 }}>Max Campaigns</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', borderColor: 'divider', py: 1.5 }}>Max Goal</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', borderColor: 'divider', py: 1.5 }}>Price</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {plans.map((plan) => {
                      const tierColor = TIER_COLORS[plan.tier] ?? '#78909C'
                      return (
                        <TableRow
                          key={plan.tier}
                          sx={{
                            '&:last-child td': { borderBottom: 0 },
                            transition: 'background 0.15s ease',
                            '&:hover': { bgcolor: alpha('#fff', 0.02) },
                          }}
                        >
                          <TableCell sx={{ borderColor: 'divider', py: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tierColor, flexShrink: 0 }} />
                              <Box>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary', lineHeight: 1.3 }}>
                                  {plan.name}
                                </Typography>
                                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.3 }}>
                                  {plan.description}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell align="center" sx={{ borderColor: 'divider', py: 1.5 }}>
                            <Chip
                              label={`${plan.platformFeePercent}%`}
                              size="small"
                              sx={{
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                bgcolor: alpha(tierColor, 0.12),
                                color: tierColor,
                                border: '1px solid',
                                borderColor: alpha(tierColor, 0.25),
                                minWidth: 52,
                              }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ borderColor: 'divider', py: 1.5 }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>
                              {plan.maxActiveCampaigns === -1 ? 'Unlimited' : plan.maxActiveCampaigns}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ borderColor: 'divider', py: 1.5 }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>
                              {plan.maxCampaignGoal === -1 ? 'Unlimited' : `$${plan.maxCampaignGoal.toLocaleString()}`}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ borderColor: 'divider', py: 1.5 }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary' }}>
                              {plan.priceMonthly === 0 ? 'Free' : `$${plan.priceMonthly}/mo`}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </SectionCard>
        </Grid>

        {/* ─── Global Payment Fees ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<MonetizationOnRoundedIcon />} title="Payment Processing" color="#8FAE96" delay={0.06}>
            <SettingRow label="Processing Fee" description="Payment processor percentage (e.g. Stripe)">
              <NumberInput value={processingFee} onChange={track(setProcessingFee)} suffix="%" />
            </SettingRow>
            <SettingRow label="Fixed Fee" description="Per-transaction flat charge">
              <NumberInput value={fixedFee} onChange={track(setFixedFee)} suffix="USD" />
            </SettingRow>
            <SettingRow label="Withdrawal Fee" description="Fee when withdrawing to bank/mobile money">
              <NumberInput value={withdrawalFee} onChange={track(setWithdrawalFee)} suffix="%" />
            </SettingRow>
          </SectionCard>
        </Grid>

        {/* ─── Global Campaign Limits ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<TuneRoundedIcon />} title="Global Campaign Limits" color="#74909A" delay={0.12}>
            <Box sx={{ px: 3, py: 1.5, bgcolor: alpha('#74909A', 0.04) }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                These are platform-wide limits. Per-tier limits (max campaigns, max goal) are configured in Manage Plans.
              </Typography>
            </Box>
            <SettingRow label="Maximum Duration" description="Longest campaign runtime allowed on the platform">
              <NumberInput value={maxDuration} onChange={track(setMaxDuration)} suffix="days" />
            </SettingRow>
            <SettingRow label="Minimum Donation" description="Smallest accepted donation amount">
              <NumberInput value={minDonation} onChange={track(setMinDonation)} suffix="USD" />
            </SettingRow>
          </SectionCard>
        </Grid>

        {/* ─── Verification ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<VerifiedUserRoundedIcon />} title="Verification Requirements" color="#AB47BC" delay={0.18}>
            <SettingRow label="Email Verification" description="Require verified email to create campaigns">
              <Toggle checked={emailRequired} onChange={track(setEmailRequired)} />
            </SettingRow>
            <SettingRow label="Phone Verification" description="Require verified phone number">
              <Toggle checked={phoneRequired} onChange={track(setPhoneRequired)} />
            </SettingRow>
            <SettingRow label="National ID" description="Require government-issued ID upload">
              <Toggle checked={nationalIdRequired} onChange={track(setNationalIdRequired)} />
            </SettingRow>
            <SettingRow label="Institutional Verification" description="Require institutional partner vouching">
              <Toggle checked={institutionalRequired} onChange={track(setInstitutionalRequired)} />
            </SettingRow>
            <SettingRow label="Auto-Approve Campaigns" description="Automatically approve campaigns from trusted users">
              <Toggle checked={autoApprove} onChange={track(setAutoApprove)} />
            </SettingRow>
            {autoApprove && (
              <Box sx={{ px: 3, py: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.primary' }}>
                    Minimum Trust Score
                  </Typography>
                  <Chip
                    label={autoApproveScore}
                    size="small"
                    sx={{ bgcolor: '#AB47BC', color: '#fff', fontWeight: 700, minWidth: 40 }}
                  />
                </Box>
                <Slider
                  value={autoApproveScore}
                  onChange={(_, v) => { setAutoApproveScore(v as number); setHasChanges(true) }}
                  min={0}
                  max={100}
                  sx={{
                    color: '#AB47BC',
                    '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.06)', height: 6 },
                    '& .MuiSlider-track': { height: 6 },
                    '& .MuiSlider-thumb': { width: 18, height: 18 },
                  }}
                  marks={[{ value: 0, label: '0' }, { value: 50, label: '50' }, { value: 100, label: '100' }]}
                />
              </Box>
            )}
          </SectionCard>
        </Grid>

        {/* ─── Notifications ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<NotificationsActiveRoundedIcon />} title="Notifications" color="#D3A95C" delay={0.24}>
            <SettingRow label="Campaign Submissions" description="Alert when new campaigns are submitted for review">
              <Toggle checked={notifCampaigns} onChange={track(setNotifCampaigns)} />
            </SettingRow>
            <SettingRow label="Dispute Alerts" description="Notify on new disputes and escalations">
              <Toggle checked={notifDisputes} onChange={track(setNotifDisputes)} />
            </SettingRow>
            <SettingRow label="Large Donations" description="Alert on donations above threshold">
              <Toggle checked={notifLargeDonations} onChange={track(setNotifLargeDonations)} />
            </SettingRow>
            <SettingRow label="Daily Summary" description="Receive daily platform summary email">
              <Toggle checked={notifDaily} onChange={track(setNotifDaily)} />
            </SettingRow>
            <SettingRow label="Weekly Report" description="Detailed weekly analytics report">
              <Toggle checked={notifWeekly} onChange={track(setNotifWeekly)} />
            </SettingRow>
            <SettingRow label="Fraud Alerts" description="Immediate alerts on suspicious activity">
              <Toggle checked={notifFraud} onChange={track(setNotifFraud)} />
            </SettingRow>
          </SectionCard>
        </Grid>

        {/* ─── Security ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<SecurityRoundedIcon />} title="Security" color="#C06B58" delay={0.3}>
            <SettingRow label="Two-Factor Authentication" description="Require 2FA for all admin accounts">
              <Toggle checked={twoFactor} onChange={track(setTwoFactor)} />
            </SettingRow>
            <SettingRow label="IP Whitelist" description="Restrict admin access to specific IPs">
              <Toggle checked={ipWhitelist} onChange={track(setIpWhitelist)} />
            </SettingRow>
            <SettingRow label="Session Timeout" description="Auto-logout after inactivity">
              <NumberInput value={sessionTimeout} onChange={track(setSessionTimeout)} suffix="min" />
            </SettingRow>
            <SettingRow label="Login Alerts" description="Email notification on admin login">
              <Toggle checked={loginAlerts} onChange={track(setLoginAlerts)} />
            </SettingRow>
          </SectionCard>
        </Grid>

        {/* ─── Appearance ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<PaletteRoundedIcon />} title="Appearance" color="#26A69A" delay={0.36}>
            <SettingRow label="Dark Mode" description="Use dark theme for admin dashboard">
              <Toggle checked={darkMode} onChange={track(setDarkMode)} />
            </SettingRow>
            <SettingRow label="Compact Mode" description="Reduce spacing for denser information display">
              <Toggle checked={compactMode} onChange={track(setCompactMode)} />
            </SettingRow>
            <SettingRow label="Animations" description="Enable UI animations and transitions">
              <Toggle checked={showAnimations} onChange={track(setShowAnimations)} />
            </SettingRow>
          </SectionCard>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          onClose={() => setSnackOpen(false)}
          icon={<CheckCircleRoundedIcon />}
          severity="success"
          variant="filled"
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          Settings saved successfully
        </Alert>
      </Snackbar>
    </Box>
  )
}
