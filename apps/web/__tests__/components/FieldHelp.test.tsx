import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { FIELD_HELP_DISMISS_LABEL, FIELD_HELP_EXAMPLES_LABEL, fieldHelpLabel, ORGANIZATION_KYC_FIELD_HELP, type FieldHelpContent } from '@ubuntu-fund/types'
import { FieldHelp } from '@/components/FieldHelp'

// The fullest entry: body, examples, a note and a footnote.
const help = ORGANIZATION_KYC_FIELD_HELP.control

function show(content: FieldHelpContent = help) {
  const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault())
  render(<ThemeProvider theme={ujimoraTheme}><form onSubmit={onSubmit}><FieldHelp help={content} /></form></ThemeProvider>)
  return { button: screen.getByRole('button', { name: fieldHelpLabel(content) }), onSubmit }
}
// A modal hides everything behind it from the accessibility tree, so look past that.
const tooltip = () => screen.queryByRole('tooltip', { hidden: true })

it('is a plain button, so it never submits the form around it', () => {
  const { button, onSubmit } = show()
  expect(button).toHaveAttribute('type', 'button')
  expect(button).toHaveAttribute('aria-haspopup', 'dialog')
  fireEvent.click(button)
  expect(onSubmit).not.toHaveBeenCalled()
})

it('shows the summary as a tooltip on hover', async () => {
  const { button } = show()
  fireEvent.mouseOver(button)
  expect(await screen.findByRole('tooltip')).toHaveTextContent(help.summary)
  expect(button).toHaveAccessibleDescription(help.summary)
  fireEvent.mouseLeave(button)
  await waitFor(() => expect(tooltip()).not.toBeInTheDocument())
})

it('shows the summary as a tooltip on keyboard focus', async () => {
  const { button } = show()
  fireEvent.keyDown(document.body, { key: 'Tab' })
  act(() => button.focus())
  expect(await screen.findByRole('tooltip')).toHaveTextContent(help.summary)
})

it('opens a popup with the body, examples, note and footnote, and Got it closes it', async () => {
  const { button } = show()
  fireEvent.mouseOver(button)
  expect(await screen.findByRole('tooltip')).toBeInTheDocument()
  fireEvent.click(button)
  const dialog = await screen.findByRole('dialog', { name: help.title })
  expect(dialog).toHaveAccessibleDescription(help.body.join(' '))
  for (const text of [...help.body, help.note!, help.footnote!]) expect(within(dialog).getByText(text)).toBeInTheDocument()
  const examples = within(dialog).getByRole('list', { name: FIELD_HELP_EXAMPLES_LABEL })
  expect(within(examples).getAllByRole('listitem').map(item => item.textContent)).toEqual(help.examples)
  // The tooltip steps aside for its own popup.
  await waitFor(() => expect(tooltip()).not.toBeInTheDocument())
  fireEvent.click(within(dialog).getByRole('button', { name: FIELD_HELP_DISMISS_LABEL }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: fieldHelpLabel(help) })).toBeInTheDocument()
  expect(tooltip()).not.toBeInTheDocument()
})

it('closes on Escape and returns focus to the button', async () => {
  const { button } = show()
  act(() => button.focus())
  fireEvent.click(button)
  const dialog = await screen.findByRole('dialog', { name: help.title })
  fireEvent.keyDown(dialog, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(button).toHaveFocus()
})

it('leaves out the parts a field has no copy for', async () => {
  const idNumber = ORGANIZATION_KYC_FIELD_HELP.idNumber
  const { button } = show(idNumber)
  fireEvent.click(button)
  const dialog = await screen.findByRole('dialog', { name: idNumber.title })
  for (const paragraph of idNumber.body) expect(within(dialog).getByText(paragraph)).toBeInTheDocument()
  expect(within(dialog).queryByRole('list')).not.toBeInTheDocument()
  expect(within(dialog).queryByText(FIELD_HELP_EXAMPLES_LABEL)).not.toBeInTheDocument()
})
