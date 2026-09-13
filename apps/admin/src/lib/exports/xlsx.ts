import { cellText, validateReport, type ExportReport } from './report'

export async function xlsxBlob(report: ExportReport): Promise<Blob> {
  validateReport(report)
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Ujimora'; workbook.created = report.generatedAt ?? new Date()
  const used = new Set<string>()
  for (const table of report.tables) {
    const base = table.title.replace(/[\\/*?:[\]]/g, ' ').slice(0, 26) || 'Report'
    let name = base, suffix = 1
    while (used.has(name.toLowerCase())) name = `${base} ${++suffix}`
    used.add(name.toLowerCase())
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
    sheet.columns = table.columns.map(column => ({ header: column.label, width: column.type === 'date' ? 25 : column.type === 'number' ? 18 : 30 }))
    for (const row of table.rows) sheet.addRow(row.map(cell => cell == null ? null : cell))
    sheet.getRow(1).eachCell(cell => { cell.font = { name: 'Outfit', bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3D2F' } } })
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      row.eachCell((cell, column) => {
        cell.font = { name: 'Outfit', size: 11 }
        cell.alignment = { vertical: 'top', wrapText: true }
        if (table.columns[column - 1].type === 'date') cell.numFmt = 'yyyy-mm-dd hh:mm:ss "UTC"'
        if (typeof cell.value === 'number') cell.numFmt = '#,##0.###############'
        // Strings remain explicit string cells; no formula or hyperlink objects are accepted.
        if (typeof cell.value === 'string' && cellText(cell.value).length > 32767) throw new Error('An Excel cell exceeds 32,767 characters. Use CSV or PDF for this report.')
      })
    })
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: table.columns.length } }
  }
  const metadata = workbook.addWorksheet(used.has('export details') ? 'Export metadata' : 'Export details')
  metadata.columns = [{ header: 'Report', width: 28 }, { header: 'Details', width: 90 }]
  metadata.addRows([['Title', report.title], ['Generated (UTC)', workbook.created.toISOString()], ['Filters', (report.filters ?? ['All records']).join(' | ')]])
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
