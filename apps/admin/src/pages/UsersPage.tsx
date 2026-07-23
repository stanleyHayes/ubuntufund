import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, TextField, MenuItem, InputAdornment } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import PeopleIcon from '@mui/icons-material/People'
import { EmptyState } from '@ubuntu-fund/ui'
import { UserRole, VerificationLevel, Resource, Action } from '@ubuntu-fund/types'
import type { User } from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import PermissionDenied from '@/components/PermissionDenied'
import { useMockData } from '@/hooks/useMockData'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'

const roleColors: Record<string, string> = {
  [UserRole.ADMIN]: '#EF5350',
  [UserRole.ORGANIZATION]: '#AB47BC',
  [UserRole.USER]: '#42A5F5',
}

const verificationLabels: Record<number, string> = {
  [VerificationLevel.NONE]: 'Unverified',
  [VerificationLevel.EMAIL_PHONE]: 'Email/Phone',
  [VerificationLevel.NATIONAL_ID]: 'National ID',
  [VerificationLevel.INSTITUTIONAL]: 'Institutional',
  [VerificationLevel.COMMUNITY]: 'Community',
}

function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 35%)`
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden',
      borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}`,
      p: 3,
      animation: `${fadeIn} 0.4s ease ${index * 0.05}s both`,
    }}>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
        <Skel w={40} h={40} />
        <Box sx={{ flex: 1 }}>
          <Skel w="60%" h={16} />
          <Box sx={{ mt: 0.8 }}><Skel w={40} h={12} /></Box>
        </Box>
      </Box>
      <Skel w="80%" h={12} />
      <Box sx={{ borderTop: `1px solid ${B}`, mt: 2, pt: 2 }}>
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

function UserCard({ user, index }: { user: User; index: number }) {
  const navigate = useNavigate()
  const roleColor = roleColors[user.role] || '#42A5F5'
  const trustColor = user.trustScore >= 70 ? '#4CAF50' : user.trustScore >= 40 ? '#FFA726' : '#EF5350'

  return (
    <Box
      onClick={() => navigate(`/users/${user.id}`)}
      sx={{
        position: 'relative', overflow: 'hidden',
        borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}`,
        p: 3, cursor: 'pointer',
        transition: 'all 0.3s ease',
        animation: `${slideIn} 0.4s ease ${index * 0.035}s both`,
        '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: roleColor, opacity: 0.35, transition: 'opacity 0.3s' },
        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', '&::before': { opacity: 1 } },
      }}
    >
      {/* Watermark */}
      <Typography sx={{
        position: 'absolute', right: 12, bottom: 8,
        fontSize: '3.5rem', fontFamily: '"TT Squares", monospace', fontWeight: 900,
        color: 'rgba(255,255,255,0.03)', lineHeight: 1, pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {user.trustScore}
      </Typography>

      {/* Avatar + Name + Role */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.2, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          width: 40, height: 40, bgcolor: nameToColor(user.name),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
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
              color: roleColor, letterSpacing: '0.08em', flexShrink: 0,
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
      <Box sx={{ borderTop: `1px solid ${B}`, mt: 1.5, pt: 1.5, position: 'relative', zIndex: 1 }}>
        {/* Trust Score */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Trust Score</Typography>
          <Typography sx={{ fontSize: '0.9rem', fontFamily: '"TT Squares", monospace', fontWeight: 700, color: trustColor }}>
            {user.trustScore}
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 3, bgcolor: 'rgba(255,255,255,0.06)' }}>
          <Box sx={{ width: `${user.trustScore}%`, height: '100%', bgcolor: trustColor, transition: 'width 0.6s ease' }} />
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
  const navigate = useNavigate()
  const { users } = useMockData()
  const { can } = useAdminPermissions()
  const PAGE_SIZE = 12
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.3s ease` }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: `1px solid ${B}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <PeopleIcon sx={{ color: '#42A5F5', fontSize: 20 }} />
        <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'text.primary' }}>
          Users
        </Typography>
      </Box>

      {/* Filter bar */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, borderBottom: `1px solid ${B}` }}>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="standard"
            placeholder="Search users..."
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
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#4CAF50' } },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.8rem' },
            }}
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            variant="standard"
            label="Role"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            fullWidth
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#4CAF50' } },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.8rem' },
            }}
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value={UserRole.ADMIN}>Admin</MenuItem>
            <MenuItem value={UserRole.ORGANIZATION}>Organization</MenuItem>
            <MenuItem value={UserRole.USER}>User</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"TT Squares", monospace', fontSize: '0.82rem', color: 'text.secondary' }}>
            {filtered.length} users
          </Typography>
        </Box>
      </Box>

      {/* Grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
      }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} index={i} />)
          : pagination.page.map((user, i) => (
              <UserCard key={user.id} user={user} index={i} />
            ))
        }
      </Box>

      {!loading && <PaginationBar pagination={pagination} accentColor="#42A5F5" />}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <EmptyState variant="search" title="No users found" description="No users match your filters. Try adjusting your search criteria." compact />
      )}
    </Box>
  )
}
