import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Checkbox from '@mui/material/Checkbox'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import { keyframes } from '@mui/material/styles'
import {
  Resource,
  Action,
  perm,
  normalizePermissions,
  type PermissionString,
  AiWritingAction,
} from '@ubuntu-fund/types'
import { AiWritingBar } from '@ubuntu-fund/ui'
import PageHeader from '@/components/PageHeader'

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

// ---------------------------------------------------------------------------
// CreateRolePage
// ---------------------------------------------------------------------------

export default function CreateRolePage() {
  const navigate = useNavigate()
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPerms, setFormPerms] = useState<Set<PermissionString>>(new Set())
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // --- Permission helpers ---

  function handlePermChange(resource: Resource, action: Action, checked: boolean) {
    setFormPerms((prev) => {
      const next = new Set(prev)
      const p = perm(resource, action)
      if (checked) {
        next.add(p)
        if (action !== Action.READ) {
          next.add(perm(resource, Action.READ))
        }
      } else {
        if (action === Action.READ) {
          ALL_ACTIONS.forEach((a) => next.delete(perm(resource, a)))
        } else {
          next.delete(p)
        }
      }
      return next
    })
  }

  function handleToggleAllRow(resource: Resource, checked: boolean) {
    setFormPerms((prev) => {
      const next = new Set(prev)
      ALL_ACTIONS.forEach((a) => {
        if (checked) {
          next.add(perm(resource, a))
        } else {
          next.delete(perm(resource, a))
        }
      })
      return next
    })
  }

  function handleToggleAllColumn(action: Action, checked: boolean) {
    setFormPerms((prev) => {
      const next = new Set(prev)
      ALL_RESOURCES.forEach((resource) => {
        if (checked) {
          next.add(perm(resource, action))
          if (action !== Action.READ) {
            next.add(perm(resource, Action.READ))
          }
        } else {
          if (action === Action.READ) {
            ALL_ACTIONS.forEach((a) => next.delete(perm(resource, a)))
          } else {
            next.delete(perm(resource, action))
          }
        }
      })
      return next
    })
  }

  function handleToggleAllPerms(checked: boolean) {
    setFormPerms(() => {
      if (!checked) return new Set<PermissionString>()
      const all = new Set<PermissionString>()
      ALL_RESOURCES.forEach((r) => ALL_ACTIONS.forEach((a) => all.add(perm(r, a))))
      return all
    })
  }

  // --- Summary data ---

  const permsByResource = ALL_RESOURCES.reduce<Record<string, PermissionString[]>>((acc, resource) => {
    const resourcePerms = ALL_ACTIONS.filter((a) => formPerms.has(perm(resource, a))).map((a) => perm(resource, a))
    if (resourcePerms.length > 0) acc[resource] = resourcePerms
    return acc
  }, {})

  const totalPermissions = formPerms.size

  // --- Save ---

  function handleCreate() {
    if (!formName.trim()) {
      setSnackbar({ open: true, message: 'Role name is required.', severity: 'error' })
      return
    }

    // In a real app, call API here
    normalizePermissions(Array.from(formPerms))
    setSnackbar({ open: true, message: `Role "${formName.trim()}" created.`, severity: 'success' })
    setTimeout(() => navigate('/roles'), 1200)
  }

  // --- Column header state ---

  const allColumnChecked = (action: Action) => ALL_RESOURCES.every((r) => formPerms.has(perm(r, action)))
  const someColumnChecked = (action: Action) =>
    ALL_RESOURCES.some((r) => formPerms.has(perm(r, action))) && !allColumnChecked(action)

  const allPermsChecked = ALL_RESOURCES.every((r) => ALL_ACTIONS.every((a) => formPerms.has(perm(r, a))))
  const somePermsChecked = formPerms.size > 0 && !allPermsChecked

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto', animation: `${fadeSlide} 0.4s ease both` }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="text.secondary"
          sx={{ cursor: 'pointer', fontSize: '0.85rem' }}
          onClick={() => navigate('/roles')}
        >
          Roles
        </Link>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>Create New Role</Typography>
      </Breadcrumbs>

      {/* Header */}
      <PageHeader
        tone="green"
        eyebrow="Platform · Roles"
        title="Create New Role"
        lede="Build a new role by choosing exactly which resources it can read, create, update, or delete."
        icon={<AdminPanelSettingsRoundedIcon />}
      />

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Main form area */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Name & Description */}
          <Card sx={{ bgcolor: '#1E1E2D', mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField
                  label="Role Name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    },
                  }}
                />
                <AiWritingBar
                  value={formDescription}
                  onChange={setFormDescription}
                  inputLabel="Role Description"
                  allowedActions={[AiWritingAction.FORMALIZE, AiWritingAction.FIX_GRAMMAR, AiWritingAction.IMPROVE_CLARITY]}
                />
                <TextField
                  label="Description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  fullWidth
                  size="small"
                  multiline
                  minRows={1}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    },
                  }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Permission Matrix */}
          <Card sx={{ bgcolor: '#1E1E2D' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                Permissions
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                Enabling Create, Update, or Delete will automatically enable Read for that resource.
              </Typography>

              <Box sx={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem' }}>
                        Resource
                      </TableCell>
                      {ALL_ACTIONS.map((a) => (
                        <TableCell key={a} align="center" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {ACTION_LABELS[a]}
                            <Checkbox
                              size="small"
                              checked={allColumnChecked(a)}
                              indeterminate={someColumnChecked(a)}
                              onChange={(_, c) => handleToggleAllColumn(a, c)}
                              sx={{
                                color: 'rgba(255,255,255,0.2)',
                                '&.Mui-checked': { color: '#5E8F72' },
                                '&.MuiCheckbox-indeterminate': { color: '#5E8F72' },
                                p: 0,
                                mt: 0.5,
                              }}
                            />
                          </Box>
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          Select All
                          <Checkbox
                            size="small"
                            checked={allPermsChecked}
                            indeterminate={somePermsChecked}
                            onChange={(_, c) => handleToggleAllPerms(c)}
                            sx={{
                              color: 'rgba(255,255,255,0.2)',
                              '&.Mui-checked': { color: '#5E8F72' },
                              '&.MuiCheckbox-indeterminate': { color: '#5E8F72' },
                              p: 0,
                              mt: 0.5,
                            }}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ALL_RESOURCES.map((resource) => {
                      const hasAnyWrite =
                        formPerms.has(perm(resource, Action.CREATE)) ||
                        formPerms.has(perm(resource, Action.UPDATE)) ||
                        formPerms.has(perm(resource, Action.DELETE))
                      const allChecked = ALL_ACTIONS.every((a) => formPerms.has(perm(resource, a)))
                      const someChecked = ALL_ACTIONS.some((a) => formPerms.has(perm(resource, a))) && !allChecked

                      return (
                        <TableRow key={resource} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                          <TableCell sx={{ color: 'text.primary', fontSize: '0.82rem', fontWeight: 500 }}>
                            {RESOURCE_LABELS[resource]}
                          </TableCell>
                          {ALL_ACTIONS.map((action) => {
                            const checked = formPerms.has(perm(resource, action))
                            const readForced = action === Action.READ && hasAnyWrite
                            return (
                              <TableCell key={action} align="center" padding="checkbox">
                                <Checkbox
                                  size="small"
                                  checked={checked}
                                  disabled={readForced}
                                  onChange={(_, c) => handlePermChange(resource, action, c)}
                                  sx={{
                                    color: 'rgba(255,255,255,0.2)',
                                    '&.Mui-checked': { color: '#5E8F72' },
                                    '&.Mui-disabled.Mui-checked': { color: '#5E8F7280' },
                                  }}
                                />
                              </TableCell>
                            )
                          })}
                          <TableCell align="center" padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={allChecked}
                              indeterminate={someChecked}
                              onChange={(_, c) => handleToggleAllRow(resource, c)}
                              sx={{
                                color: 'rgba(255,255,255,0.2)',
                                '&.Mui-checked': { color: '#5E8F72' },
                                '&.MuiCheckbox-indeterminate': { color: '#5E8F72' },
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
            <Button
              onClick={() => navigate('/roles')}
              sx={{ color: 'text.secondary' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={handleCreate}
              sx={{ bgcolor: '#5E8F72', '&:hover': { bgcolor: '#2F6B46' } }}
            >
              Create Role
            </Button>
          </Box>
        </Box>

        {/* Summary Sidebar */}
        <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0 }}>
          <Card sx={{ bgcolor: '#1E1E2D', position: 'sticky', top: 24 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Permission Summary
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#5E8F72' }}>
                  {totalPermissions}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                  permissions selected
                </Typography>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

              {Object.keys(permsByResource).length === 0 ? (
                <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem', fontStyle: 'italic' }}>
                  No permissions selected yet.
                </Typography>
              ) : (
                Object.entries(permsByResource).map(([resource, perms]) => (
                  <Box key={resource} sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                      {RESOURCE_LABELS[resource as Resource]}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {perms.map((p) => {
                        const action = p.split(':')[1]
                        return (
                          <Box
                            key={p}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              fontSize: '0.7rem',
                              color: 'text.secondary',
                            }}
                          >
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: '#5E8F72',
                              }}
                            />
                            {action}
                          </Box>
                        )
                      })}
                    </Box>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

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
