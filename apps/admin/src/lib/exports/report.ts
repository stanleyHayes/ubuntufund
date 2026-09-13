export type ExportCell = string | number | boolean | Date | null | undefined
export interface ExportColumn { label: string; type?: 'text' | 'number' | 'date'; width?: number }
export interface ExportTable { title: string; columns: ExportColumn[]; rows: ExportCell[][] }
export interface ExportReport { title: string; filters?: string[]; generatedAt?: Date; tables: ExportTable[] }
export type ExportFormat = 'pdf' | 'xlsx' | 'csv'

/** Explicit field selectors prevent raw API objects or future sensitive fields entering exports. */
export function exportTable<T>(title: string, records: T[], fields: Record<string, (record: T) => ExportCell>): ExportTable {
  const entries = Object.entries(fields)
  const rows = records.map(record => entries.map(([, read]) => read(record)))
  return { title, columns: entries.map(([label], index) => {
    const sample = rows.find(row => row[index] != null)?.[index]
    return { label, type: sample instanceof Date ? 'date' : typeof sample === 'number' ? 'number' : 'text' }
  }), rows }
}

export function validateReport(report: ExportReport): void {
  if (!report.tables.length) throw new Error('There is no report to export.')
  for (const table of report.tables) {
    if (!table.columns.length) throw new Error('The report has no columns.')
    for (const row of table.rows) {
      if (row.length !== table.columns.length) throw new Error('The report columns do not match its data.')
      for (const cell of row) {
        if (typeof cell === 'number' && !Number.isFinite(cell)) throw new Error('The report contains an invalid number.')
        if (cell instanceof Date && !Number.isFinite(cell.getTime())) throw new Error('The report contains an invalid date.')
        if (cell != null && !(cell instanceof Date) && !['string', 'number', 'boolean'].includes(typeof cell)) throw new Error('The report contains an unsupported value.')
      }
    }
  }
}

export function dateCell(value: string | Date | null | undefined): Date | null {
  return value == null ? null : new Date(value)
}
export function cellText(value: ExportCell): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

/** Spreadsheet programs must treat user-controlled strings as text, never formulas. */
export function csvCell(value: ExportCell): string {
  let text = cellText(value)
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+@\-\t\r]/u.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function reportCsv(report: ExportReport): string {
  validateReport(report)
  const rows: ExportCell[][] = report.tables.length === 1
    ? [report.tables[0].columns.map(c => c.label), ...report.tables[0].rows]
    : [['Section', 'Record', 'Field', 'Value'], ...report.tables.flatMap(table => table.rows.flatMap((row, index) => row.map((cell, column) => [table.title, index + 1, table.columns[column].label, cell])))]
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function exportFilename(title: string, format: ExportFormat, at: Date): string {
  return `ujimora-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report'}-${at.toISOString().slice(0, 10)}.${format}`
}
