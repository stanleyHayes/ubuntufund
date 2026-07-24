import { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Typography, Snackbar, Alert } from '@mui/material'
import { keyframes } from '@mui/system'
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TodayIcon from '@mui/icons-material/Today'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded'
import { AiWritingAction } from '@ubuntu-fund/types'
import { useAiUsageStats, useAiUsageLog } from '@/hooks/useApiData'
import PageHeader from '@/components/PageHeader'
import { TONES } from '@/lib/tones'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{ width: w || '100%', height: h || 14, bgcolor: 'rgba(255,255,255,0.04)' }} />
  )
}

const actionLabels: Record<AiWritingAction, string> = {
  [AiWritingAction.FORMALIZE]: 'Formalize',
  [AiWritingAction.SUMMARIZE]: 'Summarize',
  [AiWritingAction.CASUAL]: 'Casual',
  [AiWritingAction.EXPAND]: 'Expand',
  [AiWritingAction.FIX_GRAMMAR]: 'Fix Grammar',
  [AiWritingAction.CREATE_FROM_PROMPT]: 'From Prompt',
  [AiWritingAction.IMPROVE_CLARITY]: 'Improve Clarity',
  [AiWritingAction.GENERATE_TITLE]: 'Generate Title',
  [AiWritingAction.GENERATE_EMAIL]: 'Generate Email',
  [AiWritingAction.TRANSLATE]: 'Translate',
}

const actionColors: Record<AiWritingAction, string> = {
  [AiWritingAction.FORMALIZE]: '#74909A',
  [AiWritingAction.SUMMARIZE]: TONES.maroon.text,
  [AiWritingAction.CASUAL]: '#2F6B46',
  [AiWritingAction.EXPAND]: '#D3A95C',
  [AiWritingAction.FIX_GRAMMAR]: '#26A69A',
  [AiWritingAction.CREATE_FROM_PROMPT]: '#C06B58',
  [AiWritingAction.IMPROVE_CLARITY]: '#7E57C2',
  [AiWritingAction.GENERATE_TITLE]: '#29B6F6',
  [AiWritingAction.GENERATE_EMAIL]: '#8D6E63',
  [AiWritingAction.TRANSLATE]: '#EC407A',
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(d: Date): string {
  return `${formatDate(d)} \u00B7 ${formatTime(d)}`
}

function getMostUsedAction(entries: { action: AiWritingAction }[]): { action: AiWritingAction; count: number } | null {
  if (entries.length === 0) return null
  const counts = new Map<AiWritingAction, number>()
  for (const e of entries) {
    counts.set(e.action, (counts.get(e.action) || 0) + 1)
  }
  let maxAction = entries[0].action
  let maxCount = 0
  for (const [action, count] of counts) {
    if (count > maxCount) {
      maxCount = count
      maxAction = action
    }
  }
  return { action: maxAction, count: maxCount }
}

function getAverageTextLength(entries: { inputLength: number }[]): number {
  if (entries.length === 0) return 0
  return Math.round(entries.reduce((sum, e) => sum + e.inputLength, 0) / entries.length)
}

interface StatCardProps {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  index: number
}

function StatCard({ label, value, icon, color, index }: StatCardProps) {
  return (
    <Box
      sx={{
        position: 'relative',
        p: 2.5,
        borderRight: `1px solid ${B}`,
        borderBottom: `1px solid ${B}`,
        borderTop: `2px solid ${color}40`,
        borderLeft: `2px solid ${color}40`,
        animation: `${slideIn} 0.4s ease ${index * 0.06}s both`,
        transition: 'background 0.2s',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ color, opacity: 0.7, '& .MuiSvgIcon-root': { fontSize: 20 } }}>
          {icon}
        </Box>
        <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#A0A0B0', letterSpacing: 1, fontFamily: '"Outfit", sans-serif' }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', fontFamily: '"Outfit", monospace', lineHeight: 1.1 }}>
        {value}
      </Typography>
    </Box>
  )
}

export default function AiUsagePage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useAiUsageStats()
  const { data: log, isLoading: logLoading, error: logError } = useAiUsageLog()
  const [loading, setLoading] = useState(true)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMsg, setSnackbarMsg] = useState('')
  const shownErrorRef = useRef<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const err = statsError || logError
    if (err && shownErrorRef.current !== err) {
      shownErrorRef.current = err
      const timer = setTimeout(() => {
        setSnackbarMsg(err)
        setSnackbarOpen(true)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [statsError, logError])

  const mostUsed = useMemo(() => getMostUsedAction(log), [log])
  const avgLength = useMemo(() => getAverageTextLength(log), [log])

  const dailyLimit = 100
  const dailyPercent = Math.min((stats.requestsToday / dailyLimit) * 100, 100)

  const hasUsage = stats.totalRequests > 0

  if (loading || statsLoading || logLoading) {
    return (
      <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' } }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Box key={i} sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
              <Skel w={100} h={10} />
              <Box sx={{ mt: 1.5 }}><Skel w={80} h={28} /></Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
          <Skel w={200} h={14} />
          <Box sx={{ mt: 2 }}><Skel h={8} /></Box>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Skel w={160} h={14} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ mt: 1.5 }}><Skel h={40} /></Box>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.4s ease` }}>
      <Box sx={{ px: 3, pt: 3 }}>
        <PageHeader
          tone="teal"
          eyebrow="Growth"
          title="AI Writing Assistant"
          lede="Track usage of the AI writing assistant across the admin console."
          icon={<AutoAwesomeRoundedIcon />}
        />
      </Box>

      {!hasUsage ? (
        /* ═══ EMPTY STATE ═══ */
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 12,
            px: 3,
            animation: `${slideIn} 0.5s ease`,
          }}
        >
          <PsychologyRoundedIcon sx={{ fontSize: 56, color: 'rgba(255,255,255,0.08)', mb: 2 }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', mb: 0.5, fontFamily: '"Outfit", sans-serif' }}>
            No AI usage yet
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', maxWidth: 360 }}>
            Start using the AI Writing Assistant to generate content, fix grammar, and improve clarity. Your usage stats will appear here.
          </Typography>
        </Box>
      ) : (
        <>
          {/* ═══ STATS CARDS ═══ */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' } }}>
            <StatCard
              label="Total Requests"
              value={String(stats.totalRequests)}
              icon={<TrendingUpIcon />}
              color={TONES.maroon.text}
              index={0}
            />
            <StatCard
              label="Requests Today"
              value={String(stats.requestsToday)}
              icon={<TodayIcon />}
              color="#74909A"
              index={1}
            />
            <StatCard
              label="This Month"
              value={String(stats.requestsThisMonth)}
              icon={<CalendarMonthIcon />}
              color="#2F6B46"
              index={2}
            />
            <StatCard
              label="Last Used"
              value={formatDateTime(stats.lastUsedAt)}
              icon={<AccessTimeIcon />}
              color="#D3A95C"
              index={3}
            />
            <StatCard
              label="Avg Text Length"
              value={`${avgLength} chars`}
              icon={<TextFieldsIcon />}
              color="#26A69A"
              index={4}
            />
            <StatCard
              label="Most Used Action"
              value={mostUsed ? actionLabels[mostUsed.action] : '—'}
              icon={<AutoFixHighIcon />}
              color={mostUsed ? actionColors[mostUsed.action] : '#78909C'}
              index={5}
            />
          </Box>

          {/* ═══ DAILY LIMIT PROGRESS ═══ */}
          <Box
            sx={{
              p: 2.5,
              borderBottom: `1px solid ${B}`,
              borderTop: `1px solid ${B}`,
              animation: `${slideIn} 0.4s ease 0.3s both`,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#E0E0E8', fontFamily: '"Outfit", sans-serif' }}>
                Daily Limit
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: '"Outfit", monospace' }}>
                {stats.requestsToday} / {dailyLimit}
              </Typography>
            </Box>
            <Box sx={{ width: '100%', height: 6, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 0.5, overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${dailyPercent}%`,
                  bgcolor: dailyPercent >= 90 ? '#C06B58' : dailyPercent >= 70 ? '#D3A95C' : TONES.maroon.text,
                  transition: 'width 0.8s ease',
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', mt: 0.75 }}>
              {dailyPercent >= 90 ? 'You are approaching your daily limit.' : dailyPercent >= 70 ? 'Over 70% of daily limit used.' : `${Math.round(100 - dailyPercent)}% remaining today.`}
            </Typography>
          </Box>

          {/* ═══ MOST USED ACTIONS BREAKDOWN ═══ */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              borderBottom: `1px solid ${B}`,
              animation: `${slideIn} 0.4s ease 0.35s both`,
            }}
          >
            {/* Action breakdown bars */}
            <Box sx={{ borderRight: { md: `1px solid ${B}` }, borderBottom: { xs: `1px solid ${B}`, md: 'none' } }}>
              <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#E0E0E8', fontFamily: '"Outfit", sans-serif' }}>
                  Actions Breakdown
                </Typography>
              </Box>
              {(() => {
                const counts = new Map<AiWritingAction, number>()
                for (const e of log) {
                  counts.set(e.action, (counts.get(e.action) || 0) + 1)
                }
                const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
                const max = Math.max(...sorted.map(([, c]) => c), 1)
                return sorted.map(([action, count]) => (
                  <Box
                    key={action}
                    sx={{
                      px: 2.5,
                      py: 1.8,
                      borderBottom: `1px solid ${B}`,
                      transition: 'background 0.2s',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                      <Typography sx={{ fontSize: '0.78rem', color: '#E0E0E8' }}>
                        {actionLabels[action]}
                      </Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', fontFamily: '"Outfit", monospace' }}>
                        {count}
                      </Typography>
                    </Box>
                    <Box sx={{ width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.04)' }}>
                      <Box
                        sx={{
                          height: '100%',
                          width: `${(count / max) * 100}%`,
                          bgcolor: actionColors[action],
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </Box>
                  </Box>
                ))
              })()}
            </Box>

            {/* Recent activity list */}
            <Box>
              <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#E0E0E8', fontFamily: '"Outfit", sans-serif' }}>
                  Recent Activity
                </Typography>
              </Box>
              {log.slice(0, 20).map((entry, idx) => {
                const isSuccess = entry.status === 'success'
                const statusColor = isSuccess ? '#5E8F72' : '#C06B58'
                const StatusIcon = isSuccess ? CheckCircleRoundedIcon : ErrorRoundedIcon
                return (
                  <Box
                    key={entry.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 2.5,
                      py: 1.5,
                      borderBottom: `1px solid ${B}`,
                      borderLeft: `2px solid ${statusColor}25`,
                      bgcolor: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      animation: `${slideIn} 0.3s ease ${0.4 + idx * 0.02}s both`,
                      transition: 'background 0.2s ease',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.025)' },
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: `${actionColors[entry.action]}15`,
                        color: actionColors[entry.action],
                        flexShrink: 0,
                        '& .MuiSvgIcon-root': { fontSize: 16 },
                      }}
                    >
                      <AutoFixHighIcon />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#E0E0E8' }}>
                          {actionLabels[entry.action]}
                        </Typography>
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.4,
                            px: 0.6,
                            py: 0.15,
                            border: `1px solid ${statusColor}33`,
                          }}
                        >
                          <StatusIcon sx={{ fontSize: 10, color: statusColor }} />
                          <Typography sx={{ fontSize: '0.6rem', color: statusColor, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                            {entry.status}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', fontFamily: '"Outfit", monospace' }}>
                        {entry.inputLength} chars → {entry.outputLength} chars
                      </Typography>
                    </Box>

                    <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontFamily: '"Outfit", monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {formatDateTime(entry.timestamp)}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          </Box>
        </>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="error" sx={{ bgcolor: '#1a1a2e', color: '#C06B58', border: `1px solid ${B}` }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
