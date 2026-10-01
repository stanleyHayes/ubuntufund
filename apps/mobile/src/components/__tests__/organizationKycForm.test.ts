import { createElement, type ReactNode, type ChangeEvent } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ORGANIZATION_KYC_FIELD_HELP, ORGANIZATION_KYC_HELP_FIELDS, ORGANIZATION_KYC_UPLOADS, fieldHelpLabel, type FieldHelpContent } from '@ubuntu-fund/types'
import { OrganizationKYCForm } from '../OrganizationKYCForm'
import { api } from '@/lib/api'
const mocks = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
vi.mock('react-native', () => {
  const container = ({ children }: { children: ReactNode }) => createElement('div', {}, children)
  return { View: container, ScrollView: container, KeyboardAvoidingView: container, Platform: { OS: 'ios' } }
})
vi.mock('react-native-paper', () => ({
  Text: ({ children }: { children: ReactNode }) => createElement('span', {}, children), Snackbar: () => null,
  Checkbox: { Item: ({ label, status, disabled, onPress }: { label: string; status: string; disabled: boolean; onPress: () => void }) => createElement('input', { type: 'checkbox', 'aria-label': label, checked: status === 'checked', disabled, onChange: onPress }) },
}))
vi.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: mocks }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}) }))
vi.mock('../Loading', () => ({ Button: ({ children, onPress, disabled }: { children: ReactNode; onPress: () => void; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled }, children) }))
vi.mock('../BrandedTextInput', () => ({ BrandedTextInput: ({ label, value, onChangeText, disabled, right }: { label: string; value: string; onChangeText: (value: string) => void; disabled: boolean; right?: ReactNode }) => createElement('div', {}, createElement('input', { 'aria-label': label, value, disabled, onChange: (e: ChangeEvent<HTMLInputElement>) => onChangeText(e.target.value) }), right) }))
vi.mock('../FieldHelp', () => {
  const button = ({ help, disabled }: { help: FieldHelpContent; disabled?: boolean }) => createElement('button', { 'aria-label': fieldHelpLabel(help), disabled }, '?')
  return { FieldHelp: button, useFieldHelpIcon: (help: FieldHelpContent, disabled?: boolean) => ({ icon: button({ help, disabled }), dialog: null }) }
})
vi.mock('../BrandedDateField', () => ({ BrandedDateField: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => createElement('input', { 'aria-label': label, value, onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }) }))
vi.mock('../SelectionField', () => ({ SelectionField: ({ label, value, onChange, disabled, options }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; options: Array<{ value: string; label: string }> }) => createElement('select', { 'aria-label': label, value, disabled, onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) }, options.map(item => createElement('option', { key: item.value, value: item.value }, item.label))) }))
vi.mock('../MediaUploadField', () => ({ MediaUploadField: ({ label, labelAccessory, value, onChange }: { label: string; labelAccessory?: ReactNode; value: string; onChange: (value: string) => void }) => createElement('div', {}, createElement('button', { onClick: () => onChange('kyc://aaaaaaaaaaaaaaaaaaaaaaaa') }, `${label}: ${value ? 'uploaded' : 'empty'}`), labelAccessory) }))
beforeEach(() => vi.clearAllMocks())
function fill() {
  render(createElement(OrganizationKYCForm))
  for (const [label, value] of Object.entries({ 'Legal organization name': 'Synthetic charity', 'Registration number': 'REG-SYNTHETIC', 'Organization legal type': 'Charity', 'Registered street address': 'Synthetic street', 'Registered city': 'Accra', 'Representative full name': 'Representative', 'Representative date of birth': '1990-01-01', 'Representative ID number': 'SYNTHETIC-ID', 'Role and authority to act': 'Director', 'Person 1 full name': 'Controller', 'Explain ownership and control': 'The declared directors control the organization.' })) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  for (const label of ['Organization registration document', 'Representative authorization document', 'Representative identity document']) fireEvent.click(screen.getByText(`${label}: empty`))
}
function consent() {
  fireEvent.click(screen.getByLabelText(/I am authorized/))
  fireEvent.click(screen.getByLabelText(/accurate and complete/))
}
it('preserves the draft after failure and clears it only after confirmed submission', async () => {
  fill()
  expect((screen.getByText('Submit organization verification') as HTMLButtonElement).disabled).toBe(true)
  consent()
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Please retry this submission.'))
  fireEvent.click(screen.getByText('Submit organization verification'))
  expect(await screen.findByText('Please retry this submission.')).toBeTruthy()
  expect((screen.getByLabelText('Legal organization name') as HTMLInputElement).value).toBe('Synthetic charity')
  const payload = vi.mocked(api.post).mock.calls[0][1]
  expect(payload).toMatchObject({ declaration: { authorized: true, accurate: true }, documents: [{ type: 'business_registration' }, { type: 'authorization_letter' }, { type: 'id_card' }] })
  let release!: (value: unknown) => void
  vi.mocked(api.post).mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  fireEvent.click(screen.getByText('Submit organization verification'))
  expect((screen.getByText('Submit organization verification') as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByLabelText('Legal organization name') as HTMLInputElement).disabled).toBe(true)
  for (const field of ['idNumber', 'registration'] as const) expect((screen.getByRole('button', { name: fieldHelpLabel(ORGANIZATION_KYC_FIELD_HELP[field]) }) as HTMLButtonElement).disabled).toBe(true)
  release({ status: 'pending' })
  expect(await screen.findByText('Organization verification submitted for review.')).toBeTruthy()
  expect(screen.queryByLabelText('Legal organization name')).toBeNull()
  expect(api.post).toHaveBeenLastCalledWith('/kyc/business', payload)
  fireEvent.click(screen.getByText('View verification status'))
  expect(mocks.replace).toHaveBeenCalledWith('/verification')
})
it('clears identity evidence when changing type and requires a replacement before submission', async () => {
  fill(); consent()
  fireEvent.change(screen.getByLabelText('Representative identity document type'), { target: { value: 'passport' } })
  expect(screen.getByText('Representative identity document: empty')).toBeTruthy()
  fireEvent.click(screen.getByText('Submit organization verification'))
  expect(await screen.findByText(/Upload private registration/)).toBeTruthy()
  expect(api.post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Representative identity document: empty'))
  vi.mocked(api.post).mockResolvedValueOnce({ status: 'pending' })
  fireEvent.click(screen.getByText('Submit organization verification'))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
  expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ documents: [{ type: 'business_registration' }, { type: 'authorization_letter' }, { type: 'passport' }] })
})
it('puts each help button beside the field it explains', () => {
  render(createElement(OrganizationKYCForm))
  const name = (field: keyof typeof ORGANIZATION_KYC_FIELD_HELP) => fieldHelpLabel(ORGANIZATION_KYC_FIELD_HELP[field])
  for (const [field, label] of [['idNumber', 'Representative ID number'], ['representativeCapacity', 'Role and authority to act']] as const) {
    expect(within(screen.getByLabelText(label).parentElement!).getByRole('button', { name: name(field) })).toBeTruthy()
  }
  for (const [field, label] of ORGANIZATION_KYC_UPLOADS) {
    expect(within(screen.getByText(`${label}: empty`).parentElement!).getByRole('button', { name: name(field) })).toBeTruthy()
  }
  expect(screen.getAllByRole('button', { name: /^What is "/ })).toHaveLength(ORGANIZATION_KYC_HELP_FIELDS.length)
  expect((screen.getByRole('button', { name: name('control') }) as HTMLButtonElement).disabled).toBe(false)
})
