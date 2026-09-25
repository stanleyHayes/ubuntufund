import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { cellText, validateReport, type ExportCell, type ExportReport } from './report'

/**
 * Record data (names, titles, messages) renders in Noto Sans. pdfmake has no
 * per-glyph fallback, and Outfit lacks ɛ/ɔ/ɓ/ɗ/ƙ, ọ/ṣ, ₵ and ₦, so Ghanaian and
 * Nigerian names printed as missing-glyph boxes. Outfit stays for the brand
 * header and headings, whose text is fixed. Emoji and right-to-left scripts are
 * still unsupported: pdfmake cannot shape RTL text.
 */
export const BODY_FONT = 'NotoSans'
export const BRAND_FONT = 'Outfit'

export const REPORT_COLORS = { forest: '#2E3D2F', gold: '#C7A24A', sage: '#A8B5A0', ivory: '#F5F2EA', ink: '#243027' }
// Same interlocked mark as packages/ui/src/components/BrandLogo.tsx.
export const REPORT_LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="66" height="48" viewBox="0 0 66 48"><rect x="30" y="10" width="28" height="28" rx="11" transform="rotate(45 44 24)" fill="none" stroke="#A8B5A0" stroke-width="4"/><rect x="8" y="10" width="28" height="28" rx="3" transform="rotate(45 22 24)" fill="none" stroke="#C7A24A" stroke-width="4"/><path d="M 33.5 13.5 A 11 11 0 0 1 38 11.2" fill="none" stroke="#A8B5A0" stroke-width="4" stroke-linecap="round" transform="rotate(45 44 24)"/></svg>'

function pdfText(value: ExportCell): string {
  if (value instanceof Date) return value.toISOString().replace('T', '\n').replace('.000Z', ' UTC').replace('Z', ' UTC')
  if (typeof value === 'number') return value.toLocaleString('en-GB', { maximumSignificantDigits: 21 })
  return cellText(value)
}

export function pdfDefinition(report: ExportReport): TDocumentDefinitions {
  validateReport(report)
  const at = report.generatedAt ?? new Date()
  const landscape = report.tables.some(table => table.columns.length >= 6 && table.columns.length <= 8)
  const usableWidth = (landscape ? 841.89 : 595.28) - 72
  const content: Content[] = [
    { text: report.title, font: BRAND_FONT, fontSize: 24, bold: true, color: REPORT_COLORS.forest, margin: [0, 4, 0, 8] },
    { text: `Generated ${at.toISOString().replace('T', ' ').slice(0, 19)} UTC`, color: '#5F6A61', fontSize: 9, margin: [0, 0, 0, 5] },
    { text: (report.filters?.length ? report.filters : ['All records']).join(' | '), fontSize: 9, margin: [0, 0, 0, 18] },
  ]
  for (const table of report.tables) {
    content.push({ text: `${table.title} · ${table.rows.length.toLocaleString('en-GB')} ${table.rows.length === 1 ? 'record' : 'records'}`, style: 'section' })
    if (!table.rows.length) { content.push({ text: 'No records match these filters.', margin: [0, 0, 0, 18] }); continue }
    const wide = table.columns.length > 8
    const labels = wide ? ['Record', 'Field', 'Value'] : table.columns.map(column => column.label)
    const rows = wide
      ? table.rows.flatMap((row, index) => row.map((cell, column) => [String(index + 1), table.columns[column].label, pdfText(cell)]))
      : table.rows.map(row => row.map(cell => ({ text: pdfText(cell), alignment: typeof cell === 'number' ? 'right' as const : 'left' as const })))
    content.push({
      table: {
        headerRows: 1,
        // Fixed widths prevent long emails/IDs from enlarging every star column
        // beyond the page's right edge.
        widths: wide ? [38, 140, usableWidth - 220] : table.columns.map(() => usableWidth / table.columns.length - 14),
        body: [labels.map(label => ({ text: label, bold: true, color: '#FFFFFF', fillColor: REPORT_COLORS.forest })), ...rows],
      },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => '#DAE0D8',
        paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 7, paddingBottom: () => 7,
      },
      fontSize: 9, margin: [0, 0, 0, 0],
    })
  }
  return {
    info: { title: report.title, author: 'Ujimora', subject: 'Administrative report', creator: 'Ujimora Admin', creationDate: at },
    pageSize: 'A4', pageOrientation: landscape ? 'landscape' : 'portrait', pageMargins: [36, 78, 36, 48],
    defaultStyle: { font: BODY_FONT, fontSize: 10, color: REPORT_COLORS.ink, lineHeight: 1.15 },
    styles: { section: { font: BRAND_FONT, fontSize: 13, bold: true, color: REPORT_COLORS.forest, margin: [0, 8, 0, 10] } },
    watermark: { text: 'UJIMORA', color: REPORT_COLORS.sage, opacity: 0.065, bold: true, angle: -30 },
    header: {
      margin: [36, 20, 36, 0],
      stack: [
        { columns: [{ svg: REPORT_LOGO, width: 40 }, { text: 'Ujimora', font: BRAND_FONT, bold: true, fontSize: 20, color: REPORT_COLORS.forest, margin: [6, 3, 0, 0] }, { text: 'ADMINISTRATIVE REPORT', font: BRAND_FONT, alignment: 'right', fontSize: 8, color: REPORT_COLORS.forest, margin: [0, 10, 0, 0] }] },
        { canvas: [{ type: 'line', x1: 0, y1: 9, x2: landscape ? 770 : 523, y2: 9, lineWidth: 1.5, lineColor: REPORT_COLORS.gold }] },
      ],
    },
    footer: (page, total) => ({ columns: [{ text: 'Ujimora · Confidential administrative data', color: '#5F6A61' }, { text: `Page ${page} of ${total}`, alignment: 'right', color: REPORT_COLORS.forest }], fontSize: 8, margin: [36, 16, 36, 0] }),
    content,
  }
}

export async function pdfBlob(report: ExportReport): Promise<Blob> {
  const { default: pdfMake } = await import('pdfmake/build/pdfmake')
  const font = (file: string) => new URL(`/fonts/export/${file}`, window.location.origin).href
  pdfMake.addFonts({
    [BRAND_FONT]: {
      normal: font('Outfit-Regular.ttf'), bold: font('Outfit-Bold.ttf'),
      italics: font('Outfit-Regular.ttf'), bolditalics: font('Outfit-Bold.ttf'),
    },
    [BODY_FONT]: {
      normal: font('NotoSans-Regular.ttf'), bold: font('NotoSans-Bold.ttf'),
      italics: font('NotoSans-Regular.ttf'), bolditalics: font('NotoSans-Bold.ttf'),
    },
  })
  return pdfMake.createPdf(pdfDefinition(report)).getBlob()
}
