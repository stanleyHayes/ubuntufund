import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import SupervisorAccountRoundedIcon from '@mui/icons-material/SupervisorAccountRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { keyframes } from '@mui/material/styles'
import {
  Resource,
  Action,
  perm,
  DEFAULT_ROLES,
  type PermissionString,
  type Role,
} from '@ubuntu-fund/types'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const B = 'rgba(255,255,255,0.06)'

const ALL_RESOURCES = Object.values(Resource)
const ALL_ACTIONS: Action[] = [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE]
const TOTAL_PERMISSIONS = ALL_RESOURCES.length * ALL_ACTIONS.length

const ACTION_LABELS: Record<Action, string> = {
  [Action.READ]: 'Read',
  [Action.CREATE]: 'Create',
  [Action.UPDATE]: 'Update',
  [Action.DELETE]: 'Delete',
}

const ACTION_COLORS: Record<Action, string> = {
  [Action.READ]: '#74909A',
  [Action.CREATE]: '#8FAE96',
  [Action.UPDATE]: '#D3A95C',
  [Action.DELETE]: '#C06B58',
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

const ROLE_ICONS: Record<string, React.ReactNode> = {
  super_admin: <AdminPanelSettingsRoundedIcon sx={{ fontSize: 20 }} />,
  admin: <ShieldRoundedIcon sx={{ fontSize: 20 }} />,
  moderator: <SupervisorAccountRoundedIcon sx={{ fontSize: 20 }} />,
  organization: <BusinessRoundedIcon sx={{ fontSize: 20 }} />,
  user: <PersonRoundedIcon sx={{ fontSize: 20 }} />,
}

const ROLE_ACCENT: Record<string, string> = {
  super_admin: '#C06B58',
  admin: '#AB47BC',
  moderator: '#74909A',
  organization: '#D3A95C',
  user: '#8FAE96',
}

function getRoleAccent(slug: string): string {
  return ROLE_ACCENT[slug] ?? '#5E8F72'
}

function getRoleIcon(slug: string): React.ReactNode {
  return ROLE_ICONS[slug] ?? <VerifiedUserRoundedIcon sx={{ fontSize: 20 }} />
}

// Seed roles from DEFAULT_ROLES
function seedRoles(): Role[] {
  return DEFAULT_ROLES.map((r, i) => ({
    ...r,
    id: `role_seed_${i}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
}

// ---------------------------------------------------------------------------
// Permission Breakdown
// ---------------------------------------------------------------------------

function getPermissionBreakdown(permissions: PermissionString[]) {
  const permSet = new Set(permissions)
  const byAction: Record<Action, number> = {
    [Action.READ]: 0,
    [Action.CREATE]: 0,
    [Action.UPDATE]: 0,
    [Action.DELETE]: 0,
  }
  let grantedResources = 0

  for (const resource of ALL_RESOURCES) {
    let hasAny = false
    for (const action of ALL_ACTIONS) {
      if (permSet.has(perm(resource, action))) {
        byAction[action]++
        hasAny = true
      }
    }
    if (hasAny) grantedResources++
  }

  return { byAction, grantedResources, total: permissions.length }
}

// ---------------------------------------------------------------------------
// Permission Heat Grid — visual resource×action matrix
// ---------------------------------------------------------------------------

function PermissionHeatGrid({ permissions }: { permissions: PermissionString[] }) {
  const permSet = new Set(permissions)

  return (
    <Box sx={{ overflow: 'hidden' }}>
      {/* Action header */}
      <Box sx={{ display: 'flex', gap: '1px', mb: '1px', pl: '100px' }}>
        {ALL_ACTIONS.map((action) => (
          <Box
            key={action}
            sx={{
              flex: 1,
              textAlign: 'center',
              fontSize: '0.6rem',
              fontWeight: 700,
              color: 'text.secondary',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              py: 0.5,
            }}
          >
            {ACTION_LABELS[action][0]}
          </Box>
        ))}
      </Box>

      {/* Resource rows */}
      {ALL_RESOURCES.map((resource) => {
        const hasAny = ALL_ACTIONS.some((a) => permSet.has(perm(resource, a)))
        return (
          <Box key={resource} sx={{ display: 'flex', gap: '1px', mb: '1px', alignItems: 'center' }}>
            <Typography
              sx={{
                width: 100,
                fontSize: '0.6rem',
                fontWeight: 600,
                color: hasAny ? 'text.primary' : 'rgba(255,255,255,0.2)',
                pr: 1,
                textAlign: 'right',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {RESOURCE_LABELS[resource]}
            </Typography>
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
                      flex: 1,
                      height: 10,
                      bgcolor: granted ? `${ACTION_COLORS[action]}` : 'rgba(255,255,255,0.03)',
                      opacity: granted ? 0.85 : 1,
                      transition: 'all 0.2s',
                      cursor: 'default',
                      '&:hover': granted ? { opacity: 1 } : {},
                    }}
                  />
                </Tooltip>
              )
            })}
          </Box>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Action Bar — CRUD breakdown
// ---------------------------------------------------------------------------

function ActionBreakdownBar({ byAction }: { byAction: Record<Action, number> }) {
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {ALL_ACTIONS.map((action) => {
        const count = byAction[action]
        const pct = (count / ALL_RESOURCES.length) * 100
        return (
          <Tooltip
            key={action}
            title={`${ACTION_LABELS[action]}: ${count}/${ALL_RESOURCES.length} resources`}
            arrow
          >
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: ACTION_COLORS[action], letterSpacing: '0.5px' }}>
                  {ACTION_LABELS[action][0]}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'text.secondary' }}>
                  {count}
                </Typography>
              </Box>
              <Box sx={{ height: 3, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, overflow: 'hidden' }}>
                <Box
                  sx={{
                    width: `${pct}%`,
                    height: '100%',
                    bgcolor: ACTION_COLORS[action],
                    borderRadius: 1,
                    transition: 'width 0.5s ease',
                  }}
                />
              </Box>
            </Box>
          </Tooltip>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Role Card
// ---------------------------------------------------------------------------

function RoleCard({
  role,
  index,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  role: Role
  index: number
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const accent = getRoleAccent(role.slug)
  const icon = getRoleIcon(role.slug)
  const { byAction, grantedResources, total } = useMemo(
    () => getPermissionBreakdown(role.permissions),
    [role.permissions]
  )
  const coveragePct = Math.round((total / TOTAL_PERMISSIONS) * 100)

  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        animation: `${fadeSlide} 0.4s ease ${index * 0.06}s both`,
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        '&:hover': {
          borderColor: `${accent}40`,
          boxShadow: `0 0 24px ${accent}12`,
        },
      }}
    >
      {/* Top accent strip */}
      <Box sx={{ height: 3, background: accent }} />

      <Box sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              bgcolor: `${accent}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accent,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.3 }}>
                {role.name}
              </Typography>
              {role.isSystem && (
                <Chip
                  icon={<LockRoundedIcon sx={{ fontSize: '12px !important', color: `${accent} !important` }} />}
                  label="System"
                  size="small"
                  sx={{
                    bgcolor: `${accent}15`,
                    color: accent,
                    fontWeight: 700,
                    fontSize: '0.6rem',
                    height: 20,
                    '& .MuiChip-icon': { ml: '4px' },
                  }}
                />
              )}
            </Box>
            <Typography
              sx={{
                fontSize: '0.68rem',
                color: 'text.secondary',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                mt: 0.25,
              }}
            >
              {role.slug}
            </Typography>
          </Box>
        </Box>

        {/* Description */}
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'text.secondary',
            lineHeight: 1.55,
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {role.description}
        </Typography>

        {/* Stats row */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mb: 2,
          }}
        >
          <Box
            sx={{
              flex: 1,
              py: 1,
              px: 1.5,
              bgcolor: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: accent, lineHeight: 1 }}>
              {total}
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 600, color: 'text.secondary', mt: 0.25, letterSpacing: '0.3px' }}>
              PERMS
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              py: 1,
              px: 1.5,
              bgcolor: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: 'text.primary', lineHeight: 1 }}>
              {grantedResources}
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 600, color: 'text.secondary', mt: 0.25, letterSpacing: '0.3px' }}>
              RESOURCES
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              py: 1,
              px: 1.5,
              bgcolor: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: 'text.primary', lineHeight: 1 }}>
              {coveragePct}%
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 600, color: 'text.secondary', mt: 0.25, letterSpacing: '0.3px' }}>
              COVERAGE
            </Typography>
          </Box>
        </Box>

        {/* Action breakdown bars */}
        <ActionBreakdownBar byAction={byAction} />

        {/* Divider */}
        <Box sx={{ borderTop: `1px solid ${B}`, my: 2 }} />

        {/* Heat grid */}
        <Box sx={{ mb: 2, flex: 1 }}>
          <PermissionHeatGrid permissions={role.permissions} />
        </Box>

        {/* Footer actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
          {/* Coverage bar */}
          <Box sx={{ flex: 1, mr: 2 }}>
            <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${coveragePct}%`,
                  height: '100%',
                  background: accent,
                  borderRadius: 2,
                  transition: 'width 0.6s ease',
                }}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <Tooltip title="Duplicate role" arrow>
              <IconButton
                size="small"
                onClick={onDuplicate}
                sx={{ color: 'text.secondary', '&:hover': { color: '#74909A', bgcolor: 'rgba(116,144,154,0.08)' } }}
              >
                <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit role" arrow>
              <IconButton
                size="small"
                onClick={onEdit}
                sx={{ color: 'text.secondary', '&:hover': { color: '#5E8F72', bgcolor: 'rgba(94,143,114,0.08)' } }}
              >
                <EditRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={role.isSystem ? 'System roles cannot be deleted' : 'Delete role'} arrow>
              <span>
                <IconButton
                  size="small"
                  disabled={role.isSystem}
                  onClick={onDelete}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
                    '&.Mui-disabled': { color: 'rgba(255,255,255,0.08)' },
                  }}
                >
                  <DeleteRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// RolesPage
// ---------------------------------------------------------------------------

export default function RolesPage() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState<Role[]>(seedRoles)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles
    const q = searchQuery.toLowerCase()
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    )
  }, [roles, searchQuery])

  const totalPerms = useMemo(() => roles.reduce((s, r) => s + r.permissions.length, 0), [roles])
  const systemCount = useMemo(() => roles.filter((r) => r.isSystem).length, [roles])
  const customCount = roles.length - systemCount

  function handleDelete() {
    if (!deleteTarget || deleteTarget.isSystem) return
    setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    setSnackbar({ open: true, message: `Role "${deleteTarget.name}" deleted.`, severity: 'success' })
    setDeleteTarget(null)
  }

  const handleDuplicate = useCallback((role: Role) => {
    const newRole: Role = {
      ...role,
      id: `role_custom_${Date.now()}`,
      name: `${role.name} (Copy)`,
      slug: `${role.slug}_copy`,
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setRoles((prev) => [...prev, newRole])
    setSnackbar({ open: true, message: `Role duplicated as "${newRole.name}".`, severity: 'success' })
  }, [])

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <SecurityRoundedIcon sx={{ color: '#5E8F72', fontSize: 28 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Roles & Permissions
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', ml: 5.5 }}>
            Manage access control across the platform. Each role defines what users can see and do.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => navigate('/roles/new')}
          sx={{
            bgcolor: '#5E8F72',
            '&:hover': { bgcolor: '#2E3D2F' },
            flexShrink: 0,
          }}
        >
          Create Role
        </Button>
      </Box>

      {/* Summary Stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: '1px',
          bgcolor: B,
          border: `1px solid ${B}`,
          borderRadius: '12px',
          overflow: 'hidden',
          mb: 3,
          animation: `${fadeSlide} 0.3s ease both`,
        }}
      >
        {[
          { label: 'Total Roles', value: roles.length, icon: <ShieldRoundedIcon sx={{ fontSize: 18 }} />, color: '#5E8F72' },
          { label: 'System Roles', value: systemCount, icon: <LockRoundedIcon sx={{ fontSize: 18 }} />, color: '#AB47BC' },
          { label: 'Custom Roles', value: customCount, icon: <PersonRoundedIcon sx={{ fontSize: 18 }} />, color: '#74909A' },
          { label: 'Total Permissions', value: totalPerms, icon: <CheckCircleRoundedIcon sx={{ fontSize: 18 }} />, color: '#D3A95C' },
        ].map((stat) => (
          <Box
            key={stat.label}
            sx={{
              bgcolor: 'background.paper',
              py: 2,
              px: 2.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                bgcolor: `${stat.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: stat.color,
              }}
            >
              {stat.icon}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, lineHeight: 1 }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', letterSpacing: '0.3px' }}>
                {stat.label}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3, animation: `${fadeSlide} 0.3s ease 0.1s both` }}>
        <TextField
          size="small"
          placeholder="Search roles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: { xs: '100%', sm: 320 },
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.03)',
              '& fieldset': { borderColor: B },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
              '&.Mui-focused fieldset': { borderColor: '#5E8F72' },
            },
          }}
        />
      </Box>

      {/* CRUD Legend */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', animation: `${fadeSlide} 0.3s ease 0.15s both` }}>
        {ALL_ACTIONS.map((action) => (
          <Box key={action} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: ACTION_COLORS[action] }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>
              {ACTION_LABELS[action]}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Role Grid */}
      {filteredRoles.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, animation: `${fadeSlide} 0.3s ease both` }}>
          <BlockRoundedIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.12)', mb: 2 }} />
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No roles found</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            {searchQuery ? `No roles match "${searchQuery}"` : 'Create your first custom role to get started.'}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 2.5,
          }}
        >
          {filteredRoles.map((role, index) => (
            <RoleCard
              key={role.id}
              role={role}
              index={index}
              onEdit={() => navigate(`/roles/${role.id}/edit`)}
              onDelete={() => setDeleteTarget(role)}
              onDuplicate={() => handleDuplicate(role)}
            />
          ))}
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            border: `1px solid ${B}`,
            maxWidth: 400,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                bgcolor: 'rgba(192,107,88,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DeleteRoundedIcon sx={{ fontSize: 18, color: '#C06B58' }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Delete Role</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Are you sure you want to delete <strong style={{ color: '#E0E0E8' }}>{deleteTarget?.name}</strong>?
            All users assigned this role will lose the associated permissions. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDelete}
            sx={{ bgcolor: '#C06B58', '&:hover': { bgcolor: '#A5432F' } }}
          >
            Delete Role
          </Button>
        </DialogActions>
      </Dialog>

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
