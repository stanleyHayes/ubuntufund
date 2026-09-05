import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Skeleton, Box, Typography, MenuItem, InputAdornment } from '@mui/material'
import { raisedSurface, insetSurface, progressTrack } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import { UserRole, VerificationLevel } from '@ubuntu-fund/types'
import type { User } from '@ubuntu-fund/types'
import { useAdminUsers } from '@/hooks/useApiData'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'


const roleColors: Record<string, string> = {
  [UserRole.ADMIN]: '#C06B58',
  [UserRole.ORGANIZATION]: '#DCC07E',
  [UserRole.USER]: '#74909A',
}

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
  const navigate = useNavigate()
  const roleColor = roleColors[user.role] || '#74909A'
  const trustColor = user.trustScore >= 70 ? '#5E8F72' : user.trustScore >= 40 ? '#D3A95C' : '#C06B58'

  return (
    <Box
      onClick={() => navigate(`/users/${user.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') navigate(`/users/${user.id}`) }}
      sx={{
        position: 'relative', overflow: 'hidden',
        ...raisedSurface,
        p: 3, cursor: 'pointer',
        transition: 'box-shadow 160ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '&:hover': { boxShadow: 'var(--neu-raised-hover)' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 3 },
      }}
    >
      {/* Avatar + Name + Role */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.2, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          width: 40, height: 40, ...insetSurface,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, ...insetSurface, px: 1, py: 0.5, color: roleColor, letterSpacing: '0.05em' }}>
            {initials(user.name)}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </Typography>
            <Typography sx={{
              fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
              ...insetSurface, px: 1, py: 0.5, color: roleColor, letterSpacing: '0.08em', flexShrink: 0,
            }}>
              {user.role}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </Typography>
        </Box>
      </Box>

      {/* Separator */}
      <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 1.5, pt: 1.5, position: 'relative', zIndex: 1 }}>
        {/* Trust Score */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Trust Score</Typography>
          <Typography sx={{ fontSize: '0.9rem', fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: trustColor }}>
            {user.trustScore}
          </Typography>
        </Box>
        <Box sx={{ ...progressTrack }}>
          <Box sx={{ width: `${Math.max(0, Math.min(100, user.trustScore))}%`, height: '100%', bgcolor: trustColor, transition: 'width 0.6s ease' }} />
        </Box>
      </Box>

      {/* Verification */}
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 1.2, position: 'relative', zIndex: 1 }}>
        {verificationLabels[user.verificationLevel] ?? 'Unknown'}
      </Typography>

      {/* Country + Joined */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.8, position: 'relative', zIndex: 1 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
          {user.country || 'Unknown'}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
          {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </Typography>
      </Box>
    </Box>
  )
}

export default function UsersPage() {
  const { data: users, isLoading: loading, error } = useAdminUsers()
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
    <Box sx={{ bgcolor: 'background.default' }}>
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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, ...raisedSurface, mb: 3 }}>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search users..."
            slotProps={{ htmlInput: { 'aria-label': 'Search users...' } }}
            value={search}
            onChange={e => setSearch(e.target.value)}
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
            onChange={e => setRoleFilter(e.target.value)}
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

      {/* Grid */}
      <Box sx={{
        display: 'grid',
        gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
      }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : pagination.page.map((user) => (
              <UserCard key={user.id} user={user} />
            ))
        }
      </Box>

      {!loading && <PaginationBar neumorphic pagination={pagination} accentColor="#8FAE96" />}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState variant="search" title="No users found" description="No users match your filters. Try adjusting your search criteria." compact /></Box>
      )}
    </Box>
  )
}
