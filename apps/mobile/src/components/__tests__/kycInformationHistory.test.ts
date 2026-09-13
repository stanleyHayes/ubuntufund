import { createElement } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { KYCInformationHistory } from '../KYCInformationHistory'
import { api } from '@/lib/api'
vi.mock('react-native', () => ({ View: ({ children }: { children: React.ReactNode }) => createElement('div', {}, children) }))
vi.mock('react-native-paper', () => ({ Text: 'span' }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}) }))
vi.mock('../Loading', () => ({ Button: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled }, children) }))
vi.mock('../BrandedTextInput', () => ({ BrandedTextInput: ({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) => createElement('textarea', { 'aria-label': label, value, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChangeText(event.target.value) }) }))
vi.mock('../SelectionField', () => ({ SelectionField: () => null }))
vi.mock('../MediaUploadField', () => ({ MediaUploadField: ({ onChange }: { onChange: (value: string) => void }) => createElement('button', { onClick: () => onChange('kyc://aaaaaaaaaaaaaaaaaaaaaaaa') }, 'Upload fixture') }))
beforeEach(() => vi.clearAllMocks())
const exchange = { id: 'request-1', prompt: 'Please clarify your address.', requestedAt: '2026-09-13T00:00:00Z' }
it('keeps a failed response editable and sends the private document reference on retry', async () => {
  const saved = vi.fn()
  render(createElement(KYCInformationHistory, { verificationId: 'verification-1', status: 'in_review', exchanges: [exchange], onSaved: saved }))
  fireEvent.change(screen.getByLabelText('Your response'), { target: { value: 'My address is unchanged.' } })
  fireEvent.click(screen.getByText('Attach a private document'))
  expect((screen.getByText('Submit response') as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByText('Upload fixture'))
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Please retry.'))
  fireEvent.click(screen.getByText('Submit response'))
  expect(await screen.findByText('Please retry.')).toBeTruthy()
  expect((screen.getByLabelText('Your response') as HTMLTextAreaElement).value).toBe('My address is unchanged.')
  expect(saved).not.toHaveBeenCalled()
  vi.mocked(api.post).mockResolvedValueOnce({ status: 'pending' })
  fireEvent.click(screen.getByText('Submit response'))
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
  expect(await screen.findByText('Your response was submitted for review.')).toBeTruthy()
  expect(api.post).toHaveBeenLastCalledWith('/kyc/verification-1/respond-info', { requestId: 'request-1', response: 'My address is unchanged.', documents: [{ type: 'id_card', url: 'kyc://aaaaaaaaaaaaaaaaaaaaaaaa' }] })
})
it('preserves answered history and provides no response form for a closed request', () => {
  render(createElement(KYCInformationHistory, { verificationId: 'verification-1', status: 'rejected', exchanges: [{ ...exchange, response: 'Earlier answer', respondedAt: '2026-09-13T01:00:00Z' }, { ...exchange, id: 'request-2' }], onSaved() {} }))
  expect(screen.getByText('Earlier answer')).toBeTruthy()
  expect(screen.getByText('This information request is closed.')).toBeTruthy()
  expect(screen.queryByLabelText('Your response')).toBeNull()
})
