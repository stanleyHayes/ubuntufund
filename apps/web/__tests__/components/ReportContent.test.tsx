import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { ReportContent } from '@/components/safety/ReportContent'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))
it('sends an explicit report, preserves input on failure and confirms successful retry', async () => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({ id: 'report', status: 'pending' })
  render(<ThemeProvider theme={ujimoraTheme}><ReportContent userId="author" commentId="comment" /></ThemeProvider>)
  expect(api.post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Report' }))
  expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: 'What happened?' }), { target: { value: 'The comment contains repeated harassment.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
  await screen.findByText('Connection interrupted')
  expect(screen.getByRole('textbox', { name: 'What happened?' })).toHaveValue('The comment contains repeated harassment.')
  fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('status')).toHaveTextContent('Report received')
  expect(api.post).toHaveBeenLastCalledWith('/safety/reports', { targetType: 'comment', targetId: 'comment', reason: 'harassment', description: 'The comment contains repeated harassment.' })
})
it.each(['donation', 'tip'] as const)('reports a %s message by its item ID without a public author ID', async kind => {
  vi.mocked(api.post).mockReset().mockResolvedValue({ id: 'report', status: 'pending' })
  render(<ThemeProvider theme={ujimoraTheme}><ReportContent {...(kind === 'donation' ? { donationId: 'donation-id' } : { tipId: 'tip-id' })} /></ThemeProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Report' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'What happened?' }), { target: { value: 'Please review this public message.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/safety/reports', { targetType: `${kind}_message`, targetId: `${kind}-id`, reason: 'harassment', description: 'Please review this public message.' })
})

it('reports the specific campaign update instead of substituting the author account', async () => {
  vi.mocked(api.post).mockReset().mockResolvedValue({ id: 'report', status: 'pending' })
  render(<ThemeProvider theme={ujimoraTheme}><ReportContent userId="author-id" updateId="update-id" /></ThemeProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Report' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'What happened?' }), { target: { value: 'Please review this campaign update.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/safety/reports', { targetType: 'campaign_update', targetId: 'update-id', reason: 'harassment', description: 'Please review this campaign update.' })
})
