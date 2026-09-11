import { useSeo } from '@/lib/seo'
import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  MenuItem,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import { BrandedTextField as TextField, EmptyState, SHAPE } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'
type Role = 'owner' | 'admin' | 'editor' | 'viewer'
type Workspace = {
  organizationId: string
  name: string
  role: Role
  status: string
  invitationId?: string
}
type Detail = {
  name: string
  website: string
  role: Role
  members: { id: string; name: string; email: string; role: Role; status: string }[]
  campaigns: { id: string; title: string; status: string }[]
}
const labels: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  editor: 'Campaign Editor',
  viewer: 'Viewer',
}
const descriptions: Record<Role, string> = {
  owner: 'Full organization control, including finance.',
  admin: 'Manage the organization profile, invite editors/viewers, and publish campaign updates.',
  editor: 'View organization campaigns and publish updates.',
  viewer: 'View the workspace and its campaigns.',
}
const surface = {
  p: { xs: 2, sm: 3 },
  borderRadius: SHAPE.card,
  bgcolor: 'background.paper',
  boxShadow: 'var(--neu-raised)',
  minWidth: 0,
}
export function OrganizationTeamPage() {
  useSeo({
    title: 'Organization team | Ujimora',
    description:
      'Run your Ujimora organization workspace: invite colleagues by email, give each of them a role, and keep track of the campaigns you manage together.',
    path: '/organization-team',
    robots: 'noindex, nofollow',
  })
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [campaign, setCampaign] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  useEffect(() => {
    let active = true
    api
      .get<Workspace[]>('/organization-team/mine')
      .then(async (rows) => {
        const current = selected || rows.find((w) => w.status === 'active')?.organizationId || ''
        const data = current ? await api.get<Detail>(`/organization-team/${current}`) : null
        if (!active) return
        setWorkspaces(rows)
        setSelected(current)
        setDetail(data)
        setName(data?.name || '')
        setWebsite(data?.website || '')
      })
      .catch((err) => {
        if (active) { setDetail(null); setError(err.message || 'Workspace couldn’t load') }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [selected, version])
  async function mutate(action: () => Promise<unknown>, message: string) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(message)
      setLoading(true)
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again')
    } finally {
      setBusy(false)
    }
  }
  const manage = detail?.role === 'owner' || detail?.role === 'admin'
  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Stack spacing={3}>
        <Box sx={{ ...surface, position: 'relative', overflow: 'hidden' }}>
          <GroupsRoundedIcon
            aria-hidden
            sx={{
              position: 'absolute',
              right: 16,
              bottom: -20,
              fontSize: 180,
              opacity: 0.045,
              pointerEvents: 'none',
            }}
          />
          <Typography variant="overline" color="text.secondary">
            Organization workspace
          </Typography>
          <Typography variant="h4" fontWeight={800}>
            {detail?.name || 'Your organizations & teams'}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Manage on behalf of your organization using your own account.
          </Typography>
        </Box>
        {error && (
          <Alert
            severity="error"
            action={
              <Button
                onClick={() => {
                  setError('')
                  setLoading(true)
                  setVersion((v) => v + 1)
                }}
              >
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" onClose={() => setNotice('')}>
            {notice}
          </Alert>
        )}
        {loading ? (
          <Box aria-busy="true">
            <Skeleton variant="rounded" height={160} />
            <Skeleton height={100} />
          </Box>
        ) : (
          <>
            {workspaces
              .filter((w) => w.status === 'invited')
              .map((w) => (
                <Box key={w.invitationId} sx={surface}>
                  <Typography variant="h6">Invitation to {w.name}</Typography>
                  <Typography color="text.secondary">
                    {labels[w.role]} · {descriptions[w.role]}
                  </Typography>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        () =>
                          api.post(`/organization-team/invitations/${w.invitationId}/accept`, {}),
                        'Invitation accepted. You can now open this workspace.',
                      )
                    }
                  >
                    Accept invitation
                  </Button>
                </Box>
              ))}
            {!workspaces.length && !error && (
              <EmptyState
                icon={<GroupsRoundedIcon />}
                title="Your team starts here"
                description="Organization owners can invite you using your account email. Your invitations will appear here."
              />
            )}
            {workspaces.some((w) => w.status === 'active') && (
              <TextField
                select
                label="Workspace"
                value={selected}
                onChange={(e) => {
                  setLoading(true)
                  setDetail(null)
                  setSelected(e.target.value)
                  setCampaign('')
                }}
              >
                {workspaces
                  .filter((w) => w.status === 'active')
                  .map((w) => (
                    <MenuItem key={w.organizationId} value={w.organizationId}>
                      {w.name}
                    </MenuItem>
                  ))}
              </TextField>
            )}
            {detail && (
              <>
                <Box sx={surface}>
                  <Chip label={labels[detail.role]} />
                  <Typography sx={{ mt: 1 }}>{descriptions[detail.role]}</Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                    Payouts, wallet funds and ownership remain under the owner’s control.
                  </Typography>
                </Box>
                {manage && (
                  <Box sx={surface}>
                    <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                      Organization identity
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        label="Organization name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <TextField
                        label="Website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                      <Button
                        disabled={busy || name.trim().length < 2}
                        onClick={() =>
                          mutate(
                            () =>
                              api.put(`/organization-team/${selected}/profile`, {
                                organizationName: name,
                                website,
                              }),
                            'Organization profile updated.',
                          )
                        }
                      >
                        Save organization details
                      </Button>
                    </Stack>
                  </Box>
                )}
                {manage && (
                  <Box sx={surface}>
                    <Typography variant="h6" fontWeight={800}>
                      Invite a teammate
                    </Typography>
                    <Typography color="text.secondary" sx={{ my: 1 }}>
                      Use their own account email. They can accept from this page after verifying
                      their email. Invitations expire in seven days.
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        label="Email address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <TextField
                        select
                        label="Role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as Role)}
                      >
                        {(
                          [
                            'viewer',
                            'editor',
                            ...(detail.role === 'owner' ? ['admin'] : []),
                          ] as Role[]
                        ).map((r) => (
                          <MenuItem key={r} value={r}>
                            {labels[r]}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Typography color="text.secondary">{descriptions[role]}</Typography>
                      <Button
                        variant="contained"
                        disabled={busy || !email.includes('@')}
                        onClick={() =>
                          mutate(
                            () =>
                              api.post(`/organization-team/${selected}/invitations`, {
                                email,
                                role,
                              }),
                            'Invitation created. Share this workspace link with the recipient; no email has been sent.',
                          )
                        }
                      >
                        Create invitation
                      </Button>
                      <Button
                        onClick={() =>
                          navigator.clipboard
                            .writeText(`${window.location.origin}/organization-team`)
                            .then(() => setNotice('Workspace link copied.'))
                            .catch(() => setError('Couldn’t copy. Share this page’s address.'))
                        }
                      >
                        Copy workspace link
                      </Button>
                    </Stack>
                  </Box>
                )}
                {manage && (
                  <Box sx={surface}>
                    <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                      Team members & invitations
                    </Typography>
                    {!detail.members.length ? (
                      <EmptyState
                        compact
                        icon={<GroupsRoundedIcon />}
                        title="You’re the first member"
                        description="Invite people you trust to help manage this organization."
                      />
                    ) : (
                      <Stack spacing={2}>
                        {detail.members.map((member) => (
                          <Box
                            key={member.id}
                            sx={{ p: 2, bgcolor: 'action.hover', borderRadius: SHAPE.sm }}
                          >
                            <Typography fontWeight={700}>{member.name}</Typography>
                            <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                              {member.email} · {member.status}
                            </Typography>
                            <Stack
                              direction="row"
                              useFlexGap
                              flexWrap="wrap"
                              spacing={2}
                              sx={{ mt: 1 }}
                            >
                              {detail.role === 'owner' ? (
                                <TextField
                                  select
                                  label="Member role"
                                  value={member.role}
                                  disabled={busy}
                                  onChange={(e) =>
                                    mutate(
                                      () =>
                                        api.put(
                                          `/organization-team/${selected}/members/${member.id}`,
                                          { role: e.target.value },
                                        ),
                                      'Member permissions updated.',
                                    )
                                  }
                                  sx={{ minWidth: 180 }}
                                >
                                  {(['viewer', 'editor', 'admin'] as Role[]).map((r) => (
                                    <MenuItem key={r} value={r}>
                                      {labels[r]}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              ) : (
                                <Chip label={labels[member.role]} />
                              )}
                              {(detail.role === 'owner' || member.role !== 'admin') && (
                                <Button
                                  color="error"
                                  disabled={busy}
                                  onClick={() =>
                                    mutate(
                                      () =>
                                        api.delete(
                                          `/organization-team/${selected}/members/${member.id}`,
                                        ),
                                      'Access removed.',
                                    )
                                  }
                                >
                                  Remove access
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                )}
                <Box sx={surface}>
                  <Typography variant="h6" fontWeight={800}>
                    Organization campaigns
                  </Typography>
                  {!detail.campaigns.length ? (
                    <EmptyState
                      compact
                      title="No campaigns yet"
                      description="Campaigns created by the organization will appear here."
                    />
                  ) : (
                    <Stack spacing={1} sx={{ mt: 2 }}>
                      {detail.campaigns.map((c) => (
                        <Button
                          key={c.id}
                          href={`/campaigns/${c.id}`}
                          sx={{ justifyContent: 'flex-start' }}
                        >
                          {c.title}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </Box>
                {detail.role !== 'viewer' && detail.campaigns.length > 0 && (
                  <Box sx={surface}>
                    <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                      Publish a campaign update
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        select
                        label="Campaign"
                        value={campaign}
                        onChange={(e) => setCampaign(e.target.value)}
                      >
                        {detail.campaigns.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.title}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Update title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                      <TextField
                        label="Message to supporters"
                        multiline
                        minRows={3}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                      />
                      <Button
                        variant="contained"
                        disabled={busy || !campaign || title.trim().length < 3 || !content.trim()}
                        onClick={() =>
                          mutate(
                            () =>
                              api.post(
                                `/organization-team/${selected}/campaigns/${campaign}/updates`,
                                { title, content },
                              ),
                            'Campaign update published under your name.',
                          )
                        }
                      >
                        Publish update
                      </Button>
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </Stack>
    </Container>
  )
}
