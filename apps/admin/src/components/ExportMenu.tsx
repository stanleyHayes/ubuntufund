import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, LinearProgress, Menu, MenuItem } from '@mui/material'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { browserSession } from '@/lib/session'
import { exportFilename, reportCsv, validateReport, type ExportFormat, type ExportReport } from '@/lib/exports/report'
import type { ExportProgress } from '@/lib/exports/loadAll'

interface Props { title: string; disabled?: boolean; getReport: (progress: ExportProgress) => ExportReport | Promise<ExportReport> }

export default function ExportMenu({ title, disabled = false, getReport }: Props) {
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

  return <Box sx={{ mb: 2 }}>
    <Button variant="outlined" startIcon={<DownloadRoundedIcon />} aria-label={`Export ${title}`} aria-haspopup="menu" aria-expanded={!!anchor} disabled={disabled || !!progress || !user} onClick={event => setAnchor(event.currentTarget)}>Export</Button>
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
      <MenuItem onClick={() => void run('pdf')}>Branded PDF</MenuItem>
      <MenuItem onClick={() => void run('xlsx')}>Excel (.xlsx)</MenuItem>
      <MenuItem onClick={() => void run('csv')}>CSV (.csv)</MenuItem>
    </Menu>
    {progress && <Box role="status" sx={{ mt: 1, maxWidth: 480 }}><LinearProgress aria-label={progress} /><Box sx={{ mt: 1 }}>{progress} <Button disabled={progress === 'Cancelling…'} onClick={() => { active.current?.abort(); setProgress('Cancelling…') }}>Cancel</Button></Box></Box>}
    {!!error && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError('')}>{error}</Alert>}
    {!!done && <Alert severity="success" sx={{ mt: 1 }} onClose={() => setDone('')}>{done}</Alert>}
  </Box>
}
