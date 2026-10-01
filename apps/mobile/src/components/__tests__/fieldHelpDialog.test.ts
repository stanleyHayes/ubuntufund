import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FIELD_HELP_DISMISS_LABEL, FIELD_HELP_EXAMPLES_LABEL, ORGANIZATION_KYC_FIELD_HELP, fieldHelpLabel } from '@ubuntu-fund/types'

type Props = Record<string, unknown> & { children?: ReactNode }
const m = vi.hoisted(() => ({
  el: (tag: string) => ({ children }: { children?: ReactNode }) => createElement(tag, {}, children),
  dismissKeyboard: vi.fn(),
}))
vi.mock('react-native', () => ({
  View: m.el('div'), ScrollView: m.el('div'),
  Keyboard: { dismiss: m.dismissKeyboard },
  useWindowDimensions: () => ({ width: 360, height: 640 }),
}))
vi.mock('react-native-paper', () => {
  const Dialog = Object.assign(({ children, visible }: Props) => visible ? createElement('div', { role: 'dialog' }, children) : null, { Title: m.el('h2'), ScrollArea: m.el('div'), Actions: m.el('div') })
  const TextInput = {
    Icon: ({ accessibilityLabel, accessibilityHint, color, forceTextInputFocus, disabled, onPress }: Props) => createElement('button', {
      'aria-label': accessibilityLabel, title: accessibilityHint, 'data-color': color, 'data-focus-input': String(forceTextInputFocus), disabled, onClick: onPress,
    }),
  }
  return { Text: m.el('span'), Portal: ({ children }: Props) => children, Dialog, TextInput }
})
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({ text: '#1C261D', textSecondary: '#5B6B60' }) }))
vi.mock('../Loading', () => ({ Button: ({ children, onPress }: Props) => createElement('button', { onClick: onPress }, children) }))
vi.mock('../RoundedControls', () => ({
  IconButton: ({ accessibilityRole, accessibilityLabel, accessibilityHint, iconColor, disabled, onPress }: Props) => createElement('button', {
    'data-role': accessibilityRole, 'aria-label': accessibilityLabel, title: accessibilityHint, 'data-color': iconColor, disabled, onClick: onPress,
  }),
}))
import { FieldHelp, useFieldHelpIcon } from '../FieldHelp'

beforeEach(() => { vi.clearAllMocks() })
afterEach(cleanup)

// The fullest entry: body, examples, a note and a footnote.
const help = ORGANIZATION_KYC_FIELD_HELP.control

it('puts the keyboard away and opens the whole explanation, in order', () => {
  render(createElement(FieldHelp, { help }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: fieldHelpLabel(help) }))
  expect(m.dismissKeyboard).toHaveBeenCalledTimes(1)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('heading', { name: help.title })).toBeTruthy()
  const text = dialog.textContent ?? ''
  const positions = [...help.body, FIELD_HELP_EXAMPLES_LABEL, ...(help.examples ?? []), help.note!, help.footnote!].map(part => text.indexOf(part))
  expect(positions.every(position => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
})

it('closes with Got it', () => {
  render(createElement(FieldHelp, { help }))
  fireEvent.click(screen.getByRole('button', { name: fieldHelpLabel(help) }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: FIELD_HELP_DISMISS_LABEL }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('is a muted button that carries the summary as its hint, and does nothing while disabled', () => {
  render(createElement(FieldHelp, { help, disabled: true }))
  const button = screen.getByRole('button', { name: fieldHelpLabel(help) }) as HTMLButtonElement
  expect(button.getAttribute('data-role')).toBe('button')
  expect(button.getAttribute('title')).toBe(help.summary)
  expect(button.getAttribute('data-color')).toBe('#5B6B60')
  expect(button.disabled).toBe(true)
  fireEvent.click(button)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(m.dismissKeyboard).not.toHaveBeenCalled()
})

it('gives a text input its own help icon and popup, without focusing the input', () => {
  const idNumber = ORGANIZATION_KYC_FIELD_HELP.idNumber
  function Field() {
    const { icon, dialog } = useFieldHelpIcon(idNumber)
    return createElement('div', {}, icon, dialog)
  }
  render(createElement(Field))
  const icon = screen.getByRole('button', { name: fieldHelpLabel(idNumber) })
  expect(icon.getAttribute('title')).toBe(idNumber.summary)
  expect(icon.getAttribute('data-focus-input')).toBe('false')
  // No colour of its own: it takes the muted colour of the input's other icons.
  expect(icon.getAttribute('data-color')).toBeNull()
  fireEvent.click(icon)
  expect(m.dismissKeyboard).toHaveBeenCalledTimes(1)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('heading', { name: idNumber.title })).toBeTruthy()
  for (const paragraph of idNumber.body) expect(within(dialog).getByText(paragraph)).toBeTruthy()
  // This field has no examples, so no lead-in either.
  expect(within(dialog).queryByText(FIELD_HELP_EXAMPLES_LABEL)).toBeNull()
})
