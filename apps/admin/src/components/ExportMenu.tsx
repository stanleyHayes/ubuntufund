import { useEffect, useId, useRef, useState } from 'react'
import { Alert, Box, Button, LinearProgress, Menu, MenuItem, Typography } from '@mui/material'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import GridOnRoundedIcon from '@mui/icons-material/GridOnRounded'
import { raisedSurface } from '@/lib/surfaces'
import { TONES, HAIRLINE } from '@/lib/tones'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { browserSession } from '@/lib/session'
import { exportFilename, reportCsv, validateReport, type ExportFormat, type ExportReport } from '@/lib/exports/report'
import type { ExportProgress } from '@/lib/exports/loadAll'

interface Props { title: string; disabled?: boolean; getReport: (progress: ExportProgress) => ExportReport | Promise<ExportReport> }
const formats = [
  { format: 'pdf', title: 'Branded PDF', description: 'Ready to share, with Ujimora branding.', icon: PictureAsPdfRoundedIcon, tone: 'clay' },
  { format: 'xlsx', title: 'Excel (.xlsx)', description: 'Organized worksheets for analysis.', icon: TableChartRoundedIcon, tone: 'green' },
  { format: 'csv', title: 'CSV (.csv)', description: 'Plain tabular data for imports and tools.', icon: GridOnRoundedIcon, tone: 'gold' },
] as const

export default function ExportMenu({ title, disabled = false, getReport }: Props) {
  const menuId = useId()
  const { user } = useAuth()
  const location = useLocation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const active = useRef<AbortController | null>(null)
  const scope = useRef('')
  scope.current = `${user?.id ?? ''}:${location.key}`
  useEffect(() => () => {
    active.current?.abort(); active.current = null
    setProgress(''); setAnchor(null); setError(''); setDone('')
  }, [user?.id, location.key])

  async function run(format: ExportFormat) {
    if (active.current || !user || disabled) return
    const controller = new AbortController(), capturedScope = scope.current, userId = user.id
    active.current = controller
    const assertCurrent = () => {
      controller.signal.throwIfAborted()
      if (scope.current !== capturedScope || !browserSession.accessToken()) throw new Error('Your session changed. Start the export again.')
    }
    const authorize = async () => {
      assertCurrent()
      // This endpoint checks the current database role, credential version and account state.
      await api.get(`/users/${encodeURIComponent(userId)}`, { signal: controller.signal })
      assertCurrent()
    }
    setAnchor(null); setError(''); setDone(''); setProgress('Preparing export…')
    try {
      await authorize()
      const report = await getReport({ signal: controller.signal, onProgress: setProgress })
      report.generatedAt ??= new Date()
      validateReport(report); assertCurrent(); setProgress(`Creating ${format.toUpperCase()}…`)
      const blob = format === 'csv' ? new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' })
        : format === 'xlsx' ? await (await import('@/lib/exports/xlsx')).xlsxBlob(report)
          : await (await import('@/lib/exports/pdf')).pdfBlob(report)
      await authorize()
      const url = URL.createObjectURL(blob)
      try {
        const link = document.createElement('a')
        link.href = url; link.download = exportFilename(report.title, format, report.generatedAt)
        document.body.appendChild(link); link.click(); link.remove()
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
      setDone(`${format.toUpperCase()} download ready.`)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not export. Please retry.')
    } finally {
      if (active.current === controller) active.current = null
      if (scope.current === capturedScope) setProgress('')
    }
  }

  return <Box sx={{ minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
    <Button variant="outlined" startIcon={<DownloadRoundedIcon />} aria-label={`Export ${title}`} aria-haspopup="menu" aria-expanded={!!anchor} disabled={disabled || !!progress || !user} onClick={event => setAnchor(event.currentTarget)}>Export</Button>
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { ...raisedSurface, width: 360, maxWidth: 'calc(100vw - 32px)', mt: 1, overflow: 'hidden', border: `1px solid ${HAIRLINE}` } }, list: { 'aria-label': `Export ${title}`, sx: { p: 1 } } }}>
      <Box component="li" role="presentation" sx={{ position: 'relative', overflow: 'hidden', px: 1.5, pt: 1, pb: 2, mb: .5, borderBottom: `1px solid ${HAIRLINE}` }}>
        <DownloadRoundedIcon aria-hidden sx={{ position: 'absolute', right: 0, bottom: -12, fontSize: 88, color: TONES.green.text, opacity: .08, pointerEvents: 'none' }} />
        <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>Export report</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .25, position: 'relative' }}>Choose the format that fits your work.</Typography>
      </Box>
      {formats.map(({ format, title: label, description, icon: Icon, tone }) => <MenuItem key={format} aria-label={label} aria-describedby={`${menuId}-${format}`} onClick={() => void run(format)} sx={{ gap: 1.5, p: 1.5, my: .5, borderRadius: 2, whiteSpace: 'normal', alignItems: 'center', '&.Mui-focusVisible': { outline: `2px solid ${TONES.gold.text}`, outlineOffset: -2 } }}>
        <Box sx={{ width: 42, height: 42, flexShrink: 0, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: TONES[tone].soft, color: TONES[tone].text }}><Icon aria-hidden fontSize="small" /></Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '.9375rem' }}>{label}</Typography>
          <Typography id={`${menuId}-${format}`} variant="body2" color="text.secondary" sx={{ fontSize: '.8125rem', lineHeight: 1.5, mt: .25 }}>{description}</Typography>
        </Box>
      </MenuItem>)}
    </Menu>
    {progress && <Box role="status" sx={{ mt: 1, maxWidth: 480 }}><LinearProgress aria-label={progress} /><Box sx={{ mt: 1 }}>{progress} <Button disabled={progress === 'Cancelling…'} onClick={() => { active.current?.abort(); setProgress('Cancelling…') }}>Cancel</Button></Box></Box>}
    {!!error && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError('')}>{error}</Alert>}
    {!!done && <Alert severity="success" sx={{ mt: 1 }} onClose={() => setDone('')}>{done}</Alert>}
  </Box>
}
