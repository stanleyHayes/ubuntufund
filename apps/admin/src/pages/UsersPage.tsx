import { CollectionTable, CollectionViewSwitch, useCollectionView } from '@/components/CollectionView'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Skeleton, Box, Typography, MenuItem, InputAdornment, Avatar, Chip, Button } from '@mui/material'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import { EmptyState, SHAPE } from '@ubuntu-fund/ui'
import { UserRole, VerificationLevel } from '@ubuntu-fund/types'
import type { User } from '@ubuntu-fund/types'
import { useAdminUsers } from '@/hooks/useApiData'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'


const verificationLabels: Record<number, string> = {
  [VerificationLevel.NONE]: 'Unverified',
  [VerificationLevel.EMAIL_PHONE]: 'Email/Phone',
  [VerificationLevel.NATIONAL_ID]: 'National ID',
  [VerificationLevel.INSTITUTIONAL]: 'Institutional',
  [VerificationLevel.COMMUNITY]: 'Community',
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
  )
}

function SkeletonCard() {
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden',
      ...raisedSurface,
      p: 3,
    }}>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
        <Skel w={40} h={40} />
        <Box sx={{ flex: 1 }}>
          <Skel w="60%" h={16} />
          <Box sx={{ mt: 0.8 }}><Skel w={40} h={12} /></Box>
        </Box>
      </Box>
      <Skel w="80%" h={12} />
      <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 2, pt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Skel w={50} h={12} />
          <Skel w={30} h={16} />
        </Box>
        <Skel h={3} />
      </Box>
      <Box sx={{ mt: 1.5 }}><Skel w={120} h={11} /></Box>
    </Box>
  )
}

function UserCard({ user }: { user: User }) {
  return <Box component={RouterLink} to={`/users/${user.id}`} sx={{
    ...raisedSurface, border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)',
    p: 2.5, color: 'text.primary', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 2,
    '&:hover': { boxShadow: 'var(--neu-raised-hover)' },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 },
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Avatar src={user.avatarUrl} alt={user.name} sx={{ width: 48, height: 48, borderRadius: SHAPE.sm, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700 }}>{initials(user.name)}</Avatar>
      <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{user.name}</Typography><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{user.email}</Typography></Box>
    </Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}><Chip label={user.role} size="small" /><Chip label={verificationLabels[user.verificationLevel] ?? 'Unknown verification'} size="small" variant="outlined" /></Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, borderTop: 1, borderColor: 'divider', pt: 2, mt: 'auto' }}>
      <Box><Typography variant="caption" color="text.secondary">Trust score</Typography><Typography fontWeight={700}>{user.trustScore} / 100</Typography></Box>
      <Box sx={{ textAlign: 'right' }}><Typography variant="caption" color="text.secondary">Joined</Typography><Typography variant="body2">{new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</Typography></Box>
    </Box>
    <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700 }}>View member record →</Typography>
  </Box>
}

export default function UsersPage() {
  const { data: users, isLoading: loading, error } = useAdminUsers()
  const { view, changeView } = useCollectionView('users')
  const PAGE_SIZE = 12
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  return (
    <Box sx={{ color: 'text.primary', minWidth: 0 }}>
      <Box>
        <PageHeader
          tone="gold"
          eyebrow="Community"
          title="Users"
          lede="Search, filter, and manage every donor, creator, and organization account on the platform."
          icon={<PeopleRoundedIcon />}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>Could not load users. Refresh the page to try again.</Alert>}

      {/* Filter bar */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 2fr) minmax(150px, 1fr) auto' }, ...raisedSurface, mb: 3 }}>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search users..."
            slotProps={{ htmlInput: { 'aria-label': 'Search users...' } }}
            value={search}
            onChange={e => { setSearch(e.target.value); pagination.goToPage(1) }}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            variant="outlined"
            label="Role"
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); pagination.goToPage(1) }}
            fullWidth
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value={UserRole.ADMIN}>Admin</MenuItem>
            <MenuItem value={UserRole.ORGANIZATION}>Organization</MenuItem>
            <MenuItem value={UserRole.USER}>User</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'text.secondary' }}>
            {loading ? <Skeleton width={80} /> : error ? 'Unavailable' : `${filtered.length} users`}
          </Typography>
        </Box>
      </Box>

      <CollectionViewSwitch view={view} onChange={changeView} />
      {!loading && !error && filtered.length > 0 && view === 'table' ? <CollectionTable label="Users" columns={['Member', 'Role', 'Verification', 'Trust score', 'Joined']} rows={pagination.page.map(user => ({ id: user.id, cells: [
        <Box><Button component={RouterLink} to={`/users/${user.id}`} sx={{ justifyContent: 'flex-start', textAlign: 'left' }}>{user.name}</Button><Typography variant="body2" color="text.secondary">{user.email}</Typography></Box>,
        user.role, verificationLabels[user.verificationLevel] ?? 'Unknown', `${user.trustScore} / 100`, new Date(user.createdAt).toLocaleDateString(),
      ] }))} /> : (
      <>
      {/* Grid */}
      <Box sx={{
        display: 'grid',
        gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
      }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : pagination.page.map((user) => (
              <UserCard key={user.id} user={user} />
            ))
        }
      </Box>

      </>)}
      {!loading && !error && <PaginationBar neumorphic pagination={pagination} accentColor="#8FAE96" />}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState variant="search" title="No users found" description="No users match your filters. Try adjusting your search criteria." compact /><Button onClick={() => { setSearch(''); setRoleFilter('all'); pagination.goToPage(1) }}>Clear filters</Button></Box>
      )}
    </Box>
  )
}
