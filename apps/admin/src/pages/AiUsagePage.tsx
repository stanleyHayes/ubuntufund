import { useMemo } from 'react'
import { Box, Typography, Skeleton } from '@mui/material'
import { raisedSurface, insetSurface, progressTrack } from '@/lib/surfaces'
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
import { EmptyState, ErrorState } from '@ubuntu-fund/ui'
import { useAiUsageStats, useAiUsageLog } from '@/hooks/useApiData'
import PageHeader from '@/components/PageHeader'
import { TONES } from '@/lib/tones'


function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
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
  [AiWritingAction.CASUAL]: '#8FAE96',
  [AiWritingAction.EXPAND]: '#D3A95C',
  [AiWritingAction.FIX_GRAMMAR]: '#74909A',
  [AiWritingAction.CREATE_FROM_PROMPT]: '#C06B58',
  [AiWritingAction.IMPROVE_CLARITY]: '#B98A8A',
  [AiWritingAction.GENERATE_TITLE]: '#DCC07E',
  [AiWritingAction.GENERATE_EMAIL]: '#C06B58',
  [AiWritingAction.TRANSLATE]: '#C7A24A',
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

/**
 * The AI-writing endpoints (`/ai-writing/stats`, `/ai-writing/usage`) are not
 * yet implemented on the backend and currently 404. The data hooks surface a
 * failure as a plain message string (api.request throws
 * `Error(err.message || 'HTTP <status>')`) with no structured status field, so
 * we recover whatever HTTP code the message carries.
 */
function httpStatusFromError(error: string | null): number | null {
  if (!error) return null
  const match = error.match(/\b([1-5]\d{2})\b/)
  return match ? Number(match[1]) : null
}

/**
 * Decide whether a failed load means "feature not built yet" (show a calm
 * coming-soon empty state) versus a genuine error (show ErrorState).
 * An explicit 404/not-found counts as unavailable; so does any failure whose
 * message exposes no HTTP status — for a route the backend hasn't shipped, a
 * status-less failure is treated as not-yet-available rather than alarming the
 * operator. A recognisable non-404 status (e.g. 500, 403) is a real error.
 */
function isFeatureUnavailable(error: string | null): boolean {
  if (!error) return false
  const status = httpStatusFromError(error)
  if (status === 404 || /not\s*found/i.test(error)) return true
  if (status !== null) return false
  return true
}

interface StatCardProps {
  label: string
  value: string
  icon: React.ReactNode
  color: string
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <Box
      sx={{
        position: 'relative',
        p: 2.5,

        ...raisedSurface,


        transition: 'background 0.2s',
        '&:hover': { bgcolor: 'background.paper' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ ...insetSurface, display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0, color, '& .MuiSvgIcon-root': { fontSize: 20 } }}>
          {icon}
        </Box>
        <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1, fontFamily: '"Outfit", sans-serif' }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, color: 'text.primary', fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', lineHeight: 1.1 }}>
        {value}
      </Typography>
    </Box>
  )
}

export default function AiUsagePage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useAiUsageStats()
  const { data: log, isLoading: logLoading, error: logError } = useAiUsageLog()
  const mostUsed = useMemo(() => getMostUsedAction(log), [log])
  const avgLength = useMemo(() => getAverageTextLength(log), [log])

  const dailyLimit = 100
  const dailyPercent = Math.min((stats.requestsToday / dailyLimit) * 100, 100)

  const hasUsage = stats.totalRequests > 0

  // The stats endpoint gates the whole page. A 404 (or status-less failure)
  // means the AI usage feature isn't wired up yet — degrade to a calm
  // coming-soon state. A genuine non-404 failure still surfaces an ErrorState.
  const featureUnavailable = isFeatureUnavailable(statsError)
  const genuineStatsError = Boolean(statsError) && !featureUnavailable

  if (statsLoading || logLoading) {
    return (
      <Box sx={{ bgcolor: 'background.default' }}>
        <PageHeader tone="teal" eyebrow="Growth" title="AI Writing Assistant" lede="Track usage of the AI writing assistant across the admin console." icon={<AutoAwesomeRoundedIcon />} />
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Box key={i} sx={{ p: 2.5,  ...raisedSurface }}>
              <Skel w={100} h={10} />
              <Box sx={{ mt: 1.5 }}><Skel w={80} h={28} /></Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ p: 2.5, mt: 3, ...raisedSurface }}>
          <Skel w={200} h={14} />
          <Box sx={{ mt: 2 }}><Skel h={8} /></Box>
        </Box>
        <Box sx={{ p: 2.5, mt: 3, ...raisedSurface }}>
          <Skel w={160} h={14} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ mt: 1.5 }}><Skel h={40} /></Box>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: 'background.default', }}>
      <Box>
        <PageHeader
          tone="teal"
          eyebrow="Growth"
          title="AI Writing Assistant"
          lede="Track usage of the AI writing assistant across the admin console."
          icon={<AutoAwesomeRoundedIcon />}
        />
      </Box>

      {genuineStatsError ? (
        /* ═══ GENUINE ERROR ═══ */
        <ErrorState
          title="AI usage couldn't be loaded"
          message="AI usage statistics could not be loaded. This is usually temporary — refresh to try again."
          onRetry={() => window.location.reload()}
          retryLabel="Refresh"
        />
      ) : featureUnavailable ? (
        /* ═══ COMING SOON (feature not implemented yet) ═══ */
        <EmptyState
          variant="noData"
          title="AI usage tracking isn't available yet"
          description="It will appear here once the AI writing assistant records activity."
        />
      ) : !hasUsage ? (
        /* ═══ EMPTY STATE ═══ */
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            ...raisedSurface, py: 8,
            px: 3,
          }}
        >
          <PsychologyRoundedIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'text.secondary', mb: 0.5, fontFamily: '"Outfit", sans-serif' }}>
            No AI usage yet
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', textAlign: 'center', maxWidth: 360 }}>
            Start using the AI Writing Assistant to generate content, fix grammar, and improve clarity. Your usage stats will appear here.
          </Typography>
        </Box>
      ) : (
        <>
          {/* ═══ STATS CARDS ═══ */}
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
            <StatCard
              label="Total Requests"
              value={String(stats.totalRequests)}
              icon={<TrendingUpIcon />}
              color={TONES.maroon.text}
            />
            <StatCard
              label="Requests Today"
              value={String(stats.requestsToday)}
              icon={<TodayIcon />}
              color="#74909A"
            />
            <StatCard
              label="This Month"
              value={String(stats.requestsThisMonth)}
              icon={<CalendarMonthIcon />}
              color="#8FAE96"
            />
            <StatCard
              label="Last Used"
              value={stats.lastUsedAt ? formatDateTime(new Date(stats.lastUsedAt)) : '—'}
              icon={<AccessTimeIcon />}
              color="#D3A95C"
            />
            <StatCard
              label="Avg Text Length"
              value={logError ? '—' : `${avgLength} chars`}
              icon={<TextFieldsIcon />}
              color="#74909A"
            />
            <StatCard
              label="Most Used Action"
              value={mostUsed ? actionLabels[mostUsed.action] : '—'}
              icon={<AutoFixHighIcon />}
              color={mostUsed ? actionColors[mostUsed.action] : '#78909C'}
            />
          </Box>

          {/* ═══ DAILY LIMIT PROGRESS ═══ */}
          <Box
            sx={{
              p: 2.5,
              ...raisedSurface,
              mt: 3, mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.primary', fontFamily: '"Outfit", sans-serif' }}>
                Daily Limit
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: '"Outfit", monospace' }}>
                {stats.requestsToday} / {dailyLimit}
              </Typography>
            </Box>
            <Box sx={{ ...progressTrack }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${dailyPercent}%`,
                  bgcolor: dailyPercent >= 90 ? '#C06B58' : dailyPercent >= 70 ? '#D3A95C' : TONES.maroon.text,
                  transition: 'width 0.8s ease',
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.75 }}>
              {dailyPercent >= 90 ? 'You are approaching your daily limit.' : dailyPercent >= 70 ? 'Over 70% of daily limit used.' : `${Math.round(100 - dailyPercent)}% remaining today.`}
            </Typography>
          </Box>

          {/* ═══ MOST USED ACTIONS BREAKDOWN ═══ */}
          <Box
            sx={{
              display: 'grid',
              gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            {/* Action breakdown bars */}
            <Box sx={{ ...raisedSurface }}>
              <Box sx={{ p: 2.5 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', fontFamily: '"Outfit", sans-serif' }}>
                  Actions Breakdown
                </Typography>
              </Box>
              {log.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2.5 }}>{logError ? 'Action breakdown is unavailable.' : 'No actions recorded yet.'}</Typography>}
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
                      transition: 'background 0.2s',
                      '&:hover': { bgcolor: 'background.paper' },

                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.primary' }}>
                        {actionLabels[action]}
                      </Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary', fontFamily: '"Outfit", monospace' }}>
                        {count}
                      </Typography>
                    </Box>
                    <Box sx={{ ...progressTrack }}>
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
            <Box sx={raisedSurface}>
              <Box sx={{ p: 2.5 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', fontFamily: '"Outfit", sans-serif' }}>
                  Recent Activity
                </Typography>
              </Box>
              {log.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2.5 }}>{logError ? 'Recent activity is unavailable.' : 'No recent activity.'}</Typography>}
              {log.slice(0, 20).map((entry) => {
                const isSuccess = entry.status === 'success'
                const statusColor = isSuccess ? '#8FAE96' : '#C06B58'
                const StatusIcon = isSuccess ? CheckCircleRoundedIcon : ErrorRoundedIcon
                return (
                  <Box
                    key={entry.id}
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 2,
                      px: 2.5,
                      py: 1.5,


                      transition: 'background 0.2s ease',
                      '&:hover': { bgcolor: 'background.paper' },

                    }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...insetSurface,
                        color: actionColors[entry.action],
                        flexShrink: 0,
                        '& .MuiSvgIcon-root': { fontSize: 16 },
                      }}
                    >
                      <AutoFixHighIcon />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 0.3 }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.primary' }}>
                          {actionLabels[entry.action]}
                        </Typography>
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.4,
                            px: 0.6,
                            py: 0.15,
                            ...insetSurface,
                          }}
                        >
                          <StatusIcon sx={{ fontSize: 10, color: statusColor }} />
                          <Typography sx={{ fontSize: '0.6rem', color: statusColor, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                            {entry.status}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontFamily: '"Outfit", monospace' }}>
                        {entry.inputLength} chars → {entry.outputLength} chars
                      </Typography>
                    </Box>

                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {formatDateTime(new Date(entry.timestamp))}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          </Box>
        </>
      )}

    </Box>
  )
}
