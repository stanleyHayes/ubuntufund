import {
  Box,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { DEFAULT_ROLES, parsePerm } from '@ubuntu-fund/types'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import PageHeader from '@/components/PageHeader'

const actions = [
  { key: 'read', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'update', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
]
const roleIcons = [
  SecurityRoundedIcon,
  AdminPanelSettingsRoundedIcon,
  VerifiedUserRoundedIcon,
  BusinessRoundedIcon,
  PersonRoundedIcon,
]
export default function RolesPage() {
  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader
        tone="green"
        eyebrow="Access control"
        title="System roles"
        lede="See what each role can access and manage."
        icon={<SecurityRoundedIcon />}
        stats={[
          { label: 'System roles', value: DEFAULT_ROLES.length },
          { label: 'Permissions', value: 'View only' },
        ]}
      />
      <Alert severity="info" icon={<LockOutlinedIcon />} sx={{ mb: 3 }}>
        These built-in roles apply across the platform. Permissions are shown for reference and
        cannot be edited here.
      </Alert>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {DEFAULT_ROLES.map((role, index) => {
          const resources = [
            ...new Set(role.permissions.map((permission) => parsePerm(permission).resource)),
          ]
          const Icon = roleIcons[index] ?? PersonRoundedIcon
          return (
            <Box
              component="article"
              key={role.slug}
              sx={{
                ...raisedSurface,
                p: { xs: 2, sm: 3 },
                position: 'relative',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              <Icon
                aria-hidden
                sx={{
                  position: 'absolute',
                  right: -25,
                  top: 20,
                  fontSize: 185,
                  color: 'primary.main',
                  opacity: 0.045,
                  transform: 'rotate(-15deg)',
                  pointerEvents: 'none',
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
                <Box
                  sx={{
                    ...insetSurface,
                    width: 52,
                    height: 52,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'primary.main',
                    flexShrink: 0,
                  }}
                >
                  <Icon fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1 }}>
                    BUILT-IN ROLE
                  </Typography>
                  <Typography component="h2" variant="h6" fontWeight={800}>
                    {role.name}
                  </Typography>
                </Box>
              </Box>
              <Typography
                color="text.secondary"
                sx={{ my: 2.5, lineHeight: 1.7, position: 'relative', minHeight: { sm: 55 } }}
              >
                {role.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 4, pb: 2.5, position: 'relative' }}>
                {[
                  { value: role.permissions.length, label: 'Permissions' },
                  { value: resources.length, label: 'Areas of access' },
                ].map((stat) => (
                  <Box key={stat.label}>
                    <Typography variant="h5" fontWeight={800}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box
                component="details"
                sx={{
                  position: 'relative',
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  '& summary': {
                    cursor: 'pointer',
                    py: 2,
                    color: 'primary.main',
                    fontWeight: 700,
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                  },
                }}
              >
                <summary>Explore permissions</summary>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  A check means this role has access. A dash means access is not granted.
                </Typography>
                <TableContainer>
                  <Table
                    size="small"
                    aria-label={`${role.name} permissions`}
                    sx={{
                      '& th, & td': { borderColor: 'divider', py: 1.5, px: 0.75 },
                      '& th': { color: 'text.secondary', fontSize: 12 },
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Area</TableCell>
                        {actions.map((action) => (
                          <TableCell key={action.key} align="center">
                            {action.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {resources.map((resource) => (
                        <TableRow key={resource}>
                          <TableCell
                            component="th"
                            scope="row"
                            sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                          >
                            {resource.replaceAll('_', ' ')}
                          </TableCell>
                          {actions.map((action) => {
                            const allowed = role.permissions.some(
                              (permission) =>
                                parsePerm(permission).resource === resource &&
                                parsePerm(permission).action === action.key,
                            )
                            return (
                              <TableCell
                                key={action.key}
                                align="center"
                                aria-label={`${action.label}: ${allowed ? 'Allowed' : 'Not granted'}`}
                              >
                                {allowed ? (
                                  <CheckRoundedIcon
                                    aria-hidden
                                    sx={{ fontSize: 19, color: 'primary.main' }}
                                  />
                                ) : (
                                  <Typography aria-hidden variant="body2" color="text.disabled">
                                    —
                                  </Typography>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
