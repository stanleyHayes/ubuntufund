import { describe, expect, it } from 'vitest'
import { ORGANIZATION_KYC_FIELD_HELP, ORGANIZATION_KYC_HELP_FIELDS, ORGANIZATION_KYC_UPLOAD_NOTE, ORGANIZATION_KYC_UPLOADS, fieldHelpLabel, type OrganizationKycHelpField } from '@ubuntu-fund/types'
import { fieldHelpAccessibility } from '../fieldHelp'

const uploads: readonly OrganizationKycHelpField[] = ORGANIZATION_KYC_UPLOADS.map(([key]) => key)
const filled = (text: string | undefined) => typeof text === 'string' && text.trim().length > 0

describe('organization verification field help', () => {
  it('covers exactly the fields that carry a help button', () => {
    expect(new Set(ORGANIZATION_KYC_HELP_FIELDS).size).toBe(ORGANIZATION_KYC_HELP_FIELDS.length)
    expect(Object.keys(ORGANIZATION_KYC_FIELD_HELP).sort()).toEqual([...ORGANIZATION_KYC_HELP_FIELDS].sort())
  })

  it.each(ORGANIZATION_KYC_HELP_FIELDS)('gives %s a title, a summary and a body, with no blank lines', field => {
    const help = ORGANIZATION_KYC_FIELD_HELP[field]
    expect(filled(help.title)).toBe(true)
    expect(filled(help.summary)).toBe(true)
    expect(help.body.length).toBeGreaterThan(0)
    for (const line of [...help.body, ...(help.examples ?? [])]) expect(filled(line)).toBe(true)
    if (help.examples) expect(help.examples.length).toBeGreaterThan(0)
    if ('note' in help) expect(filled(help.note)).toBe(true)
    if ('footnote' in help) expect(filled(help.footnote)).toBe(true)
  })

  it('has help for every upload in the form, each ending with the private-upload note', () => {
    expect(uploads).toEqual(['registration', 'authorization', 'identity', 'control'])
    for (const field of uploads) {
      expect(ORGANIZATION_KYC_HELP_FIELDS).toContain(field)
      expect(ORGANIZATION_KYC_FIELD_HELP[field].footnote).toBe(ORGANIZATION_KYC_UPLOAD_NOTE)
    }
  })

  it('keeps the upload note off the typed fields', () => {
    const typed = ORGANIZATION_KYC_HELP_FIELDS.filter(field => !uploads.includes(field))
    expect(typed).toEqual(['representativeCapacity', 'idNumber'])
    for (const field of typed) expect(ORGANIZATION_KYC_FIELD_HELP[field].footnote).not.toBe(ORGANIZATION_KYC_UPLOAD_NOTE)
  })
})

describe('fieldHelpAccessibility', () => {
  it('names the button by the question the popup answers and hints the one-line answer', () => {
    const help = ORGANIZATION_KYC_FIELD_HELP.idNumber
    expect(fieldHelpAccessibility(help)).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'What is "Representative ID number"?',
      accessibilityHint: help.summary,
    })
  })

  it('gives every help button on the form its own name', () => {
    const names = ORGANIZATION_KYC_HELP_FIELDS.map(field => fieldHelpAccessibility(ORGANIZATION_KYC_FIELD_HELP[field]).accessibilityLabel)
    expect(new Set(names).size).toBe(names.length)
    for (const [index, field] of ORGANIZATION_KYC_HELP_FIELDS.entries()) expect(names[index]).toBe(fieldHelpLabel(ORGANIZATION_KYC_FIELD_HELP[field]))
  })
})
