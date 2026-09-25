import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { BODY_FONT, BRAND_FONT, pdfDefinition } from '@/lib/exports/pdf'
import { exportTable } from '@/lib/exports/report'

/**
 * pdfmake has no per-glyph fallback. The export used Outfit everywhere, which
 * has no ɛ/ɔ/ɓ/ɗ/ƙ, ọ/ṣ, ₵ or ₦, so donor names and campaign titles such as
 * "Ɛsi Dɛnkyɛm" printed as missing-glyph boxes. Record data now uses the
 * bundled Noto Sans (coverage checked with fontTools when it was added).
 */
it('renders record data in the broad-coverage font and keeps Outfit for fixed brand text', () => {
  const definition = pdfDefinition({ title: 'Donations', tables: [exportTable('Donations', [{ name: 'Ɛsi Dɛnkyɛm', amount: 20 }], { Name: r => r.name, Amount: r => r.amount })] })
  expect(definition.defaultStyle?.font).toBe(BODY_FONT)
  expect(definition.styles?.section?.font).toBe(BRAND_FONT)
  const json = JSON.stringify(definition)
  expect(json).toContain('Ɛsi Dɛnkyɛm')
  // Table cells never set their own font, so they inherit the body font.
  const table = (definition.content as { table?: { body: { text: string; font?: string }[][] } }[]).find(item => item.table)!
  expect(table.table!.body[1][0]).toMatchObject({ text: 'Ɛsi Dɛnkyɛm' })
  expect(table.table!.body[1][0].font).toBeUndefined()
})

it('ships the Noto Sans files the export registers, with their licence', () => {
  // Vitest runs with apps/admin as the cwd.
  const dir = resolve(process.cwd(), 'public/fonts/export')
  for (const file of ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf']) expect(existsSync(resolve(dir, file)), file).toBe(true)
  expect(readFileSync(resolve(dir, 'NotoSans-OFL.txt'), 'utf8')).toContain('SIL Open Font License')
})
