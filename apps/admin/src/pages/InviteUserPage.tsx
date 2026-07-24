import { useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Checkbox from '@mui/material/Checkbox'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import { keyframes } from '@mui/material/styles'
import {
  Resource,
  Action,
  perm,
  normalizePermissions,
  computeEffectivePermissions,
  DEFAULT_ROLES,
  type PermissionString,
  type Role,
} from '@ubuntu-fund/types'

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_RESOURCES = Object.values(Resource)
const ALL_ACTIONS: Action[] = [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE]

const ACTION_LABELS: Record<Action, string> = {
  [Action.READ]: 'Read',
  [Action.CREATE]: 'Create',
  [Action.UPDATE]: 'Update',
  [Action.DELETE]: 'Delete',
}

const RESOURCE_LABELS: Record<Resource, string> = Object.fromEntries(
  ALL_RESOURCES.map((r) => [
    r,
    r
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
  ])
) as Record<Resource, string>

const AFRICAN_COUNTRIES = [
  'Ghana',
  'Kenya',
  'Nigeria',
  'South Africa',
  'Rwanda',
  'Tanzania',
  'Uganda',
  'Ethiopia',
  'Senegal',
  'Cameroon',
  'DRC',
  'Mali',
]

// Seed roles
const MOCK_ROLES: Role[] = DEFAULT_ROLES.map((r, i) => ({
  ...r,
  id: `role_seed_${i}`,
  createdAt: new Date(),
  updatedAt: new Date(),
}))

// ---------------------------------------------------------------------------
// Permission Dot Grid (compact)
// ---------------------------------------------------------------------------

function PermissionDotGrid({ permissions }: { permissions: PermissionString[] }) {
  const permSet = new Set(permissions)
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {ALL_RESOURCES.map((resource) => (
        <Tooltip key={resource} title={RESOURCE_LABELS[resource]} arrow placement="top">
          <Box sx={{ display: 'flex', gap: '3px' }}>
            {ALL_ACTIONS.map((action) => {
              const granted = permSet.has(perm(resource, action))
              return (
                <Tooltip
                  key={action}
                  title={`${RESOURCE_LABELS[resource]}: ${ACTION_LABELS[action]}`}
                  arrow
                  placement="top"
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: granted ? '#5E8F72' : 'rgba(255,255,255,0.08)',
                      transition: 'background-color 0.2s',
                    }}
                  />
                </Tooltip>
              )
            })}
          </Box>
        </Tooltip>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Tri-state permission override
// ---------------------------------------------------------------------------

type OverrideState = 'inherited' | 'added' | 'removed'

interface OverrideMap {
  [key: string]: OverrideState
}

function getOverrideColor(state: OverrideState): string {
  switch (state) {
    case 'inherited':
      return '#5E8F72'
    case 'added':
      return '#74909A'
    case 'removed':
      return '#C06B58'
  }
}

function getOverrideLabel(state: OverrideState): string {
  switch (state) {
    case 'inherited':
      return 'Inherited from role'
    case 'added':
      return 'Added override'
    case 'removed':
      return 'Removed override'
  }
}

// ---------------------------------------------------------------------------
// InviteUserPage
// ---------------------------------------------------------------------------

export default function InviteUserPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [country, setCountry] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [overrides, setOverrides] = useState<OverrideMap>({})
  const [showOverrides, setShowOverrides] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const selectedRole = useMemo(
    () => MOCK_ROLES.find((r) => r.id === selectedRoleId) ?? null,
    [selectedRoleId]
  )

  const rolePermSet = useMemo(
    () => new Set(selectedRole?.permissions ?? []),
    [selectedRole]
  )

  // Compute effective permissions from role + overrides
  const effectivePermissions = useMemo(() => {
    if (!selectedRole) return []
    const grantedExtras: PermissionString[] = []
    const revokedFromRole: PermissionString[] = []
    for (const [key, state] of Object.entries(overrides)) {
      const p = key as PermissionString
      if (state === 'added') grantedExtras.push(p)
      if (state === 'removed') revokedFromRole.push(p)
    }
    return computeEffectivePermissions(selectedRole.permissions, grantedExtras, revokedFromRole)
  }, [selectedRole, overrides])

  // Build initial override map when role changes
  function handleRoleChange(roleId: string) {
    setSelectedRoleId(roleId)
    setOverrides({})
    setShowOverrides(false)
  }

  // Cycle override state for a specific permission cell
  function handleOverrideToggle(resource: Resource, action: Action) {
    const key = perm(resource, action) as string
    const isInRole = rolePermSet.has(perm(resource, action))
    const current = overrides[key]

    setOverrides((prev) => {
      const next = { ...prev }

      if (isInRole) {
        // In role: inherited -> removed -> inherited
        if (!current || current === 'inherited') {
          next[key] = 'removed'
        } else {
          delete next[key]
        }
      } else {
        // Not in role: (none) -> added -> (none)
        if (!current || current === 'removed') {
          next[key] = 'added'
          // Auto-add read if adding a write action
          if (action !== Action.READ) {
            const readKey = perm(resource, Action.READ) as string
            if (!rolePermSet.has(perm(resource, Action.READ)) && next[readKey] !== 'added') {
              next[readKey] = 'added'
            }
          }
        } else {
          delete next[key]
        }
      }

      return next
    })
  }

  function getPermState(resource: Resource, action: Action): { effective: boolean; state: OverrideState | 'none' } {
    const p = perm(resource, action)
    const isInRole = rolePermSet.has(p)
    const override = overrides[p as string]

    if (override === 'added') return { effective: true, state: 'added' }
    if (override === 'removed') return { effective: false, state: 'removed' }
    if (isInRole) return { effective: true, state: 'inherited' }
    return { effective: false, state: 'none' }
  }

  function handleSubmit() {
    if (!name.trim()) {
      setSnackbar({ open: true, message: 'Name is required.', severity: 'error' })
      return
    }
    if (!email.trim()) {
      setSnackbar({ open: true, message: 'Email is required.', severity: 'error' })
      return
    }
    if (!selectedRoleId) {
      setSnackbar({ open: true, message: 'Please select a role.', severity: 'error' })
      return
    }
    if (selectedRole?.slug === 'organization' && !organizationName.trim()) {
      setSnackbar({ open: true, message: 'Organization name is required for the Organization role.', severity: 'error' })
      return
    }

    // Mock submit
    setSnackbar({ open: true, message: `User "${name.trim()}" invited with role "${selectedRole?.name}".`, severity: 'success' })

    // Reset form
    setName('')
    setEmail('')
    setPassword('')
    setCountry('')
    setOrganizationName('')
    setSelectedRoleId('')
    setOverrides({})
    setShowOverrides(false)
  }

  const isOrganizationRole = selectedRole?.slug === 'organization'

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4, animation: `${fadeSlide} 0.4s ease both` }}>
        <PersonAddRoundedIcon sx={{ color: '#5E8F72', fontSize: 28 }} />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Invite User
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left column: Form */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card
            sx={{
              bgcolor: '#1E1E2D',
              animation: `${fadeSlide} 0.4s ease 0.05s both`,
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>
                User Details
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  size="small"
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' } },
                  }}
                />

                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  size="small"
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' } },
                  }}
                />

                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Auto-generated if empty"
                  sx={{
                    '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' } },
                  }}
                />

                <TextField
                  label="Country"
                  select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' } },
                  }}
                >
                  <MenuItem value="">
                    <em>Select country</em>
                  </MenuItem>
                  {AFRICAN_COUNTRIES.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>

                {isOrganizationRole && (
                  <TextField
                    label="Organization Name"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    fullWidth
                    size="small"
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' } },
                    }}
                  />
                )}
              </Box>

              <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.06)' }} />

              {/* Role selector */}
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Assign Role
              </Typography>

              <RadioGroup
                value={selectedRoleId}
                onChange={(e) => handleRoleChange(e.target.value)}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {MOCK_ROLES.map((role) => (
                    <Card
                      key={role.id}
                      sx={{
                        bgcolor: selectedRoleId === role.id ? 'rgba(76,175,80,0.08)' : 'rgba(255,255,255,0.02)',
                        border: selectedRoleId === role.id ? '1px solid rgba(76,175,80,0.4)' : '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': { borderColor: 'rgba(76,175,80,0.25)' },
                      }}
                      onClick={() => handleRoleChange(role.id)}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <FormControlLabel
                            value={role.id}
                            control={
                              <Radio
                                size="small"
                                sx={{
                                  color: 'rgba(255,255,255,0.2)',
                                  '&.Mui-checked': { color: '#5E8F72' },
                                }}
                              />
                            }
                            label=""
                            sx={{ m: 0, mr: 0 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ShieldRoundedIcon sx={{ color: '#5E8F72', fontSize: 16 }} />
                              <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                {role.name}
                              </Typography>
                              {role.isSystem && (
                                <Chip
                                  label="System"
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(76,175,80,0.15)',
                                    color: '#A8B5A0',
                                    fontWeight: 600,
                                    fontSize: '0.62rem',
                                    height: 18,
                                  }}
                                />
                              )}
                              <Chip
                                label={`${role.permissions.length}`}
                                size="small"
                                sx={{
                                  bgcolor: 'rgba(255,255,255,0.05)',
                                  color: 'text.secondary',
                                  fontSize: '0.62rem',
                                  height: 18,
                                  ml: 'auto',
                                }}
                              />
                            </Box>
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
                              {role.description}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </RadioGroup>

              <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.06)' }} />

              <Button
                variant="contained"
                startIcon={<PersonAddRoundedIcon />}
                onClick={handleSubmit}
                fullWidth
                size="large"
                sx={{
                  bgcolor: '#5E8F72',
                  '&:hover': { bgcolor: '#2F6B46' },
                  py: 1.5,
                  fontSize: '1rem',
                }}
              >
                Invite User
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column: Permission preview + overrides */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card
            sx={{
              bgcolor: '#1E1E2D',
              animation: `${fadeSlide} 0.4s ease 0.1s both`,
              position: 'sticky',
              top: 24,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SecurityRoundedIcon sx={{ color: '#5E8F72', fontSize: 20 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Permission Preview
                </Typography>
              </Box>

              {!selectedRole ? (
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', py: 4, textAlign: 'center' }}>
                  Select a role to preview permissions.
                </Typography>
              ) : (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 1 }}>
                      Base permissions for <strong style={{ color: '#E0E0E8' }}>{selectedRole.name}</strong>:
                    </Typography>
                    <PermissionDotGrid permissions={effectivePermissions} />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#5E8F72' }} />
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>Granted</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>Not granted</Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

                  {/* Override toggle */}
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowOverrides(!showOverrides)}
                    sx={{
                      borderColor: 'rgba(255,255,255,0.12)',
                      color: 'text.secondary',
                      fontSize: '0.78rem',
                      mb: showOverrides ? 2 : 0,
                      '&:hover': { borderColor: '#5E8F72', color: '#5E8F72' },
                    }}
                  >
                    {showOverrides ? 'Hide Permission Overrides' : 'Customize Permissions'}
                  </Button>

                  {showOverrides && (
                    <>
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1 }}>
                        Click a cell to toggle override. Colors indicate state:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                        {(['inherited', 'added', 'removed'] as OverrideState[]).map((s) => (
                          <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: getOverrideColor(s) }} />
                            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'capitalize' }}>
                              {s}
                            </Typography>
                          </Box>
                        ))}
                      </Box>

                      <Box
                        sx={{
                          maxHeight: 400,
                          overflowY: 'auto',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 1,
                        }}
                      >
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.7rem', py: 0.75 }}>
                                Resource
                              </TableCell>
                              {ALL_ACTIONS.map((a) => (
                                <TableCell
                                  key={a}
                                  align="center"
                                  sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.7rem', py: 0.75, px: 0.5 }}
                                >
                                  {ACTION_LABELS[a].charAt(0)}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {ALL_RESOURCES.map((resource) => (
                              <TableRow key={resource} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                                <TableCell sx={{ color: 'text.primary', fontSize: '0.72rem', fontWeight: 500, py: 0.5 }}>
                                  {RESOURCE_LABELS[resource]}
                                </TableCell>
                                {ALL_ACTIONS.map((action) => {
                                  const { effective, state } = getPermState(resource, action)
                                  const color =
                                    state === 'none'
                                      ? 'rgba(255,255,255,0.08)'
                                      : getOverrideColor(state as OverrideState)
                                  return (
                                    <TableCell
                                      key={action}
                                      align="center"
                                      padding="none"
                                      sx={{ py: 0.5, px: 0.5, cursor: 'pointer' }}
                                      onClick={() => handleOverrideToggle(resource, action)}
                                    >
                                      <Tooltip
                                        title={
                                          state === 'none'
                                            ? 'Not granted - click to add'
                                            : `${getOverrideLabel(state as OverrideState)} - click to toggle`
                                        }
                                        arrow
                                        placement="top"
                                      >
                                        <Box
                                          sx={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: '50%',
                                            bgcolor: color,
                                            mx: 'auto',
                                            transition: 'box-shadow 200ms ease, opacity 200ms ease',
                                            border: state === 'removed' ? '2px solid #C06B58' : 'none',
                                            opacity: effective ? 1 : 0.5,
                                            '&:hover': { boxShadow: '0 0 0 3px rgba(255,255,255,0.18)' },
                                          }}
                                        />
                                      </Tooltip>
                                    </TableCell>
                                  )
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>

                      {/* Override summary */}
                      {Object.keys(overrides).length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.75 }}>
                            Overrides applied:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {Object.entries(overrides).map(([key, state]) => (
                              <Chip
                                key={key}
                                label={`${state === 'added' ? '+' : '-'} ${key}`}
                                size="small"
                                onDelete={() =>
                                  setOverrides((prev) => {
                                    const next = { ...prev }
                                    delete next[key]
                                    return next
                                  })
                                }
                                sx={{
                                  bgcolor:
                                    state === 'added'
                                      ? 'rgba(66,165,245,0.12)'
                                      : 'rgba(239,83,80,0.12)',
                                  color: state === 'added' ? '#74909A' : '#C06B58',
                                  fontSize: '0.65rem',
                                  height: 22,
                                  '& .MuiChip-deleteIcon': {
                                    color: state === 'added' ? '#74909A' : '#C06B58',
                                    fontSize: 14,
                                  },
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
