import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, expect, it, vi } from 'vitest'
import { Workbook } from 'exceljs'
import { csvCell, exportTable, reportCsv, validateReport, type ExportReport } from '@/lib/exports/report'
import { xlsxBlob } from '@/lib/exports/xlsx'
import { usersTable } from '@/lib/exports/tables'
import type { User } from '@ubuntu-fund/types'

afterEach(() => vi.unstubAllGlobals())
it('escapes spreadsheet formula prefixes and quotes while preserving numeric amounts and Unicode', () => {
  for (const text of ['=1+2', '+SUM(A1)', '-cmd', '@SUM(A1)', '  =DDE()', '\t=1']) expect(csvCell(text)).toBe(`"'${text}"`)
  expect(csvCell(-12.25)).toBe('"-12.25"')
  const report = { title: 'Donations', tables: [exportTable('Donations', [{ name: 'Ama, "Ɛsi"\nKofi', amount: 12.25 }], { Name: r => r.name, Amount: r => r.amount })] }
  expect(reportCsv(report)).toBe('\uFEFF"Name","Amount"\r\n"Ama, ""Ɛsi""\nKofi","12.25"\r\n')
})
it('preserves every section in CSV and retains headers for empty single-table reports', () => {
  expect(reportCsv({ title: 'Empty', tables: [exportTable('Users', [], { Name: () => '' })] })).toContain('"Name"\r\n')
  const report = { title: 'Multi', tables: [exportTable('First', [2], { Count: n => n }), exportTable('Second', [3], { Amount: n => n })] }
  expect(reportCsv(report)).toContain('"First","1","Count","2"')
  expect(reportCsv(report)).toContain('"Second","1","Amount","3"')
})
it('rejects malformed, invalid and raw object cells instead of silently dropping data', () => {
  for (const value of [NaN, Infinity, new Date('invalid'), { password: 'secret' }]) {
    expect(() => validateReport({ title: 'Invalid', tables: [{ title: 'Data', columns: [{ label: 'Value' }], rows: [[value]] }] } as ExportReport)).toThrow()
  }
  expect(() => validateReport({ title: 'Invalid', tables: [{ title: 'Data', columns: [{ label: 'Value' }], rows: [[1, 2]] }] })).toThrow()
})
it('exports only selected user fields, without credential or private document leakage', () => {
  const row = { id: 'member', name: 'Ama', email: 'ama@example.test', role: 'user', verificationLevel: 0, trustScore: 20, createdAt: new Date(), passwordHash: 'forbidden-secret', mfaSecret: 'forbidden-mfa', documentUrl: 'forbidden-document' } as unknown as User
  const table = usersTable([row])
  expect(JSON.stringify(table)).not.toContain('forbidden')
  expect(table.rows[0]).toContain('Ama')
})
it('round-trips a real XLSX with typed amounts, dates, safe strings and all 1,205 rows', async () => {
  vi.stubGlobal('Blob', NodeBlob)
  const date = new Date('2026-09-12T13:12:11Z')
  const records = Array.from({ length: 1205 }, (_, id) => ({ id: `00${id}`, name: id ? 'Ama' : '=HYPERLINK("https://example.test")', amount: id + 0.25, date }))
  const report = { title: 'Donations', generatedAt: date, filters: ['Currency: GHS'], tables: [exportTable('Donations', records, { ID: r => r.id, Name: r => r.name, Amount: r => r.amount, Date: r => r.date })] }
  const blob = await xlsxBlob(report)
  const workbook = new Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())
  const sheet = workbook.getWorksheet('Donations')!
  expect(sheet.rowCount).toBe(1206)
  expect(sheet.getCell('A2').value).toBe('000')
  expect(sheet.getCell('B2').value).toBe('=HYPERLINK("https://example.test")')
  expect(sheet.getCell('B2').type).toBe(3)
  expect(sheet.getCell('C1206').value).toBe(1204.25)
  expect(sheet.getCell('D2').value).toEqual(date)
  expect(workbook.getWorksheet('Export details')!.getCell('B4').value).toBe('Currency: GHS')
})
