import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import { DEFAULT_ROLES, parsePerm } from '@ubuntu-fund/types'
import PageHeader from '@/components/PageHeader'

export default function RolesPage() {
  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <PageHeader
        tone="green"
        eyebrow="Access control"
        title="System roles"
        lede="Review the canonical permission baselines enforced by the API."
        icon={<SecurityRoundedIcon />}
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        Roles are code-defined system policy. Custom role creation and per-user overrides are not enabled, so this page is intentionally read-only.
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
        {DEFAULT_ROLES.map((role) => {
          const resources = [...new Set(role.permissions.map((permission) => parsePerm(permission).resource))]
          return (
            <Card key={role.slug}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{role.name}</Typography>
                  <Chip label="System" size="small" color="primary" variant="outlined" />
                </Box>
                <Typography color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>{role.description}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {role.permissions.length} permissions across {resources.length} resources
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
                  {resources.map((resource) => <Chip key={resource} label={resource.replace(/_/g, ' ')} size="small" />)}
                </Box>
              </CardContent>
            </Card>
          )
        })}
      </Box>
    </Box>
  )
}
