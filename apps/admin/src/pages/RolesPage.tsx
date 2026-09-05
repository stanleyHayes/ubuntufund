import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import { DEFAULT_ROLES, parsePerm } from '@ubuntu-fund/types'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import PageHeader from '@/components/PageHeader'

export default function RolesPage() {
  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader
        tone="green"
        eyebrow="Access control"
        title="System roles"
        lede="Review the canonical permission baselines enforced by the API."
        icon={<SecurityRoundedIcon />}
        stats={[{ label: 'System roles', value: DEFAULT_ROLES.length }, { label: 'Policy', value: 'Read-only' }]}
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        Roles are code-defined system policy. Custom role creation and per-user overrides are not enabled, so this page is intentionally read-only.
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
        {DEFAULT_ROLES.map((role) => {
          const resources = [...new Set(role.permissions.map((permission) => parsePerm(permission).resource))]
          return (
            <Card key={role.slug} sx={{ ...raisedSurface, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{role.name}</Typography>
                  <Chip label="System" size="small" color="primary" variant="outlined" />
                </Box>
                <Typography color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>{role.description}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {role.permissions.length} permissions across {resources.length} resources
                </Typography>
                <Box component="details" sx={{ mt: 2, '& summary': { cursor: 'pointer', p: 1.5, borderRadius: 1, color: 'primary.main', fontSize: '.875rem', fontWeight: 700, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } } }}>
                  <summary>View resource permissions</summary>
                  <Box sx={{ ...insetSurface, mt: 1, p: 2, display: 'grid', gap: 2 }}>
                    {resources.map((resource) => <Box key={resource}>
                      <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'capitalize' }}>{resource.replace(/_/g, ' ')}</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {role.permissions.filter((permission) => parsePerm(permission).resource === resource).map((permission) =>
                          <Chip key={permission} label={parsePerm(permission).action.replace(/_/g, ' ')} size="small" />)}
                      </Box>
                    </Box>)}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )
        })}
      </Box>
    </Box>
  )
}
