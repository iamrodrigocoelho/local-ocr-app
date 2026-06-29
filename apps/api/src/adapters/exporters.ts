import ExcelJS from 'exceljs'
import type { OcrResult } from '@ocr-reader/shared'

export function toJson(result: OcrResult): string {
  return JSON.stringify(result, null, 2)
}

export function toCsv(result: OcrResult): string {
  const rows: string[] = ['page,field,value,confidence']
  for (const [field, data] of Object.entries(result.extraction.fields)) {
    const value = data.value === null ? '' : String(data.value)
    rows.push(`${data.page},${csvCell(field)},${csvCell(value)},${data.confidence}`)
  }
  return rows.join('\n')
}

export async function toExcel(result: OcrResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'OCR File Reader'
  wb.created = new Date()

  // Sheet 1: extracted fields
  const fieldsSheet = wb.addWorksheet('Campos')
  fieldsSheet.columns = [
    { header: 'Página', key: 'page', width: 10 },
    { header: 'Campo', key: 'field', width: 24 },
    { header: 'Valor', key: 'value', width: 32 },
    { header: 'Confiança', key: 'confidence', width: 14 },
  ]
  for (const [field, data] of Object.entries(result.extraction.fields)) {
    fieldsSheet.addRow({
      page: data.page,
      field,
      value: data.value ?? '',
      confidence: data.confidence,
    })
  }

  // Sheet 2: transcriptions per page
  const transcriptSheet = wb.addWorksheet('Transcrição')
  transcriptSheet.columns = [
    { header: 'Página', key: 'page', width: 10 },
    { header: 'Texto', key: 'text', width: 80 },
  ]
  for (const page of result.pages) {
    transcriptSheet.addRow({ page: page.page, text: page.transcription.markdown })
  }

  // Sheet 3: document metadata
  const metaSheet = wb.addWorksheet('Metadados')
  const meta = [
    ['Arquivo', result.source.filename],
    ['Tipo', result.source.mimeType],
    ['Tamanho (bytes)', result.source.sizeBytes],
    ['Páginas', result.source.pageCount],
    ['Modelo', result.model.name],
    ['Status', result.processing.status],
    ['Duração (ms)', result.processing.durationMs ?? ''],
    ['ID do documento', result.documentId],
  ]
  for (const [key, value] of meta) {
    metaSheet.addRow([key, value])
  }

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
