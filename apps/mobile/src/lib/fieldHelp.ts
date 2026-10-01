import { fieldHelpLabel, type FieldHelpContent } from '@ubuntu-fund/types'

/**
 * Screen-reader props for a field's help button, the same beside a label and
 * inside a text input. The name asks the question the popup answers and the
 * hint is the one-line answer, so the gist is heard without opening it.
 */
export function fieldHelpAccessibility(help: Pick<FieldHelpContent, 'title' | 'summary'>) {
  return { accessibilityRole: 'button', accessibilityLabel: fieldHelpLabel(help), accessibilityHint: help.summary } as const
}
