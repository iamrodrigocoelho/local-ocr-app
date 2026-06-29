import { describe, it, expect } from 'vitest'
import { toJson, toCsv, toExcel } from '../adapters/exporters.js'
import type { OcrResult } from '@ocr-reader/shared'

const MOCK_RESULT: OcrResult = {
  schemaVersion: '1.0',
  documentId: '550e8400-e29b-41d4-a716-446655440000',
  source: { filename: 'test.png', mimeType: 'image/png', sizeBytes: 1024, pageCount: 1 },
  model: { name: 'chandra', provider: 'ollama', endpoint: 'http://localhost:11434' },
  processing: {
    status: 'completed',
    startedAt: '2026-06-28T18:30:00.000Z',
    finishedAt: '2026-06-28T18:35:00.000Z',
    durationMs: 300000,
    error: null,
  },
  pages: [
    {
      page: 1,
      transcription: { markdown: '## Hello\nWorld', html: null },
      metrics: { inputTokens: 100, outputTokens: 200, evalTokensPerSecond: 4.7 },
    },
  ],
  extraction: {
    documentType: 'receipt',
    fields: {
      total: { value: 45.8, confidence: 0.93, page: 1 },
      name: { value: 'Rodrigo', confidence: 0.99, page: 1 },
      'field,with,commas': { value: 'value "quoted"', confidence: 0.8, page: 1 },
      missing: { value: null, confidence: 0.0, page: 1 },
    },
    warnings: [],
  },
}

const EMPTY_FIELDS_RESULT: OcrResult = {
  ...MOCK_RESULT,
  extraction: { ...MOCK_RESULT.extraction, fields: {} },
}

describe('toJson', () => {
  it('returns a valid JSON string', () => {
    const json = toJson(MOCK_RESULT)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('round-trips the result', () => {
    const parsed = JSON.parse(toJson(MOCK_RESULT))
    expect(parsed.documentId).toBe(MOCK_RESULT.documentId)
    expect(parsed.pages).toHaveLength(1)
  })
})

describe('toCsv', () => {
  it('includes a header row', () => {
    const csv = toCsv(MOCK_RESULT)
    expect(csv.split('\n')[0]).toMatch(/page.*field.*value.*confidence/i)
  })

  it('produces one data row per field', () => {
    const lines = toCsv(MOCK_RESULT).split('\n').filter(Boolean)
    expect(lines).toHaveLength(1 + Object.keys(MOCK_RESULT.extraction.fields).length)
  })

  it('escapes values containing commas', () => {
    const csv = toCsv(MOCK_RESULT)
    expect(csv).toContain('"field,with,commas"')
  })

  it('escapes values containing double quotes', () => {
    const csv = toCsv(MOCK_RESULT)
    expect(csv).toContain('""quoted""')
  })

  it('represents null values as empty string', () => {
    const csv = toCsv(MOCK_RESULT)
    const missingRow = csv.split('\n').find((l) => l.includes('missing'))
    expect(missingRow).toBeTruthy()
    // value column should be empty: ...missing,,0...
    expect(missingRow).toMatch(/missing,,/)
  })

  it('produces only header when fields is empty', () => {
    const lines = toCsv(EMPTY_FIELDS_RESULT).split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
  })
})

describe('toExcel', () => {
  it('returns a Buffer', async () => {
    const buf = await toExcel(MOCK_RESULT)
    expect(Buffer.isBuffer(buf)).toBe(true)
  })

  it('returns a non-empty buffer', async () => {
    const buf = await toExcel(MOCK_RESULT)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('starts with XLSX/ZIP magic bytes (PK\\x03\\x04)', async () => {
    const buf = await toExcel(MOCK_RESULT)
    expect(buf[0]).toBe(0x50) // P
    expect(buf[1]).toBe(0x4b) // K
    expect(buf[2]).toBe(0x03)
    expect(buf[3]).toBe(0x04)
  })

  it('works when fields is empty', async () => {
    const buf = await toExcel(EMPTY_FIELDS_RESULT)
    expect(buf.length).toBeGreaterThan(0)
  })
})
