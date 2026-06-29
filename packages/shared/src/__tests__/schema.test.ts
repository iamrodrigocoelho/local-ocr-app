import { describe, it, expect } from 'vitest'
import { OcrResultSchema } from '../schema.js'

const validResult = {
  schemaVersion: '1.0',
  documentId: '550e8400-e29b-41d4-a716-446655440000',
  source: {
    filename: 'test.png',
    mimeType: 'image/png',
    sizeBytes: 184320,
    pageCount: 1,
  },
  model: {
    name: 'fredrezones55/chandra-ocr-2:patch',
    provider: 'ollama',
    endpoint: 'http://localhost:11434',
  },
  processing: {
    status: 'completed',
    startedAt: '2026-06-28T18:30:00.000Z',
    finishedAt: '2026-06-28T18:35:02.000Z',
    durationMs: 302005,
    error: null,
  },
  pages: [
    {
      page: 1,
      transcription: {
        markdown: '## Test Doc\n| Item | Value |',
        html: null,
      },
      metrics: {
        inputTokens: 271,
        outputTokens: 1099,
        evalTokensPerSecond: 4.7,
      },
    },
  ],
  extraction: {
    documentType: 'receipt',
    fields: {
      total: { value: 45.8, confidence: 0.93, page: 1 },
      missing: { value: null, confidence: 0.0, page: 1 },
    },
    warnings: [],
  },
}

describe('OcrResultSchema', () => {
  it('validates a complete valid result', () => {
    expect(OcrResultSchema.safeParse(validResult).success).toBe(true)
  })

  it('accepts all valid processing statuses', () => {
    const statuses = ['queued', 'processing', 'completed', 'failed', 'canceled']
    for (const status of statuses) {
      const result = { ...validResult, processing: { ...validResult.processing, status } }
      expect(OcrResultSchema.safeParse(result).success).toBe(true)
    }
  })

  it('rejects invalid processing status', () => {
    const result = {
      ...validResult,
      processing: { ...validResult.processing, status: 'unknown' },
    }
    expect(OcrResultSchema.safeParse(result).success).toBe(false)
  })

  it('requires schemaVersion', () => {
    const { schemaVersion: _s, ...rest } = validResult
    expect(OcrResultSchema.safeParse(rest).success).toBe(false)
  })

  it('requires documentId', () => {
    const { documentId: _d, ...rest } = validResult
    expect(OcrResultSchema.safeParse(rest).success).toBe(false)
  })

  it('allows null field values (absent fields present with null)', () => {
    const result = {
      ...validResult,
      extraction: {
        ...validResult.extraction,
        fields: { total: { value: null, confidence: 0.0, page: 1 } },
      },
    }
    expect(OcrResultSchema.safeParse(result).success).toBe(true)
  })

  it('allows null processing.error on completed jobs', () => {
    expect(OcrResultSchema.safeParse(validResult).success).toBe(true)
  })

  it('allows string processing.error on failed jobs', () => {
    const result = {
      ...validResult,
      processing: {
        ...validResult.processing,
        status: 'failed',
        error: 'Ollama connection refused',
      },
    }
    expect(OcrResultSchema.safeParse(result).success).toBe(true)
  })

  it('allows null transcription.html', () => {
    expect(OcrResultSchema.safeParse(validResult).success).toBe(true)
  })

  it('supports multiple pages', () => {
    const result = {
      ...validResult,
      pages: [validResult.pages[0], { ...validResult.pages[0], page: 2 }],
    }
    expect(OcrResultSchema.safeParse(result).success).toBe(true)
  })

  it('rejects empty pages array', () => {
    const result = { ...validResult, pages: [] }
    expect(OcrResultSchema.safeParse(result).success).toBe(false)
  })

  it('requires sizeBytes to be positive', () => {
    const result = {
      ...validResult,
      source: { ...validResult.source, sizeBytes: 0 },
    }
    expect(OcrResultSchema.safeParse(result).success).toBe(false)
  })

  it('rejects confidence outside [0, 1]', () => {
    const result = {
      ...validResult,
      extraction: {
        ...validResult.extraction,
        fields: { total: { value: 45.8, confidence: 1.5, page: 1 } },
      },
    }
    expect(OcrResultSchema.safeParse(result).success).toBe(false)
  })

  it('requires at least one warning entry to be a string', () => {
    const result = {
      ...validResult,
      extraction: { ...validResult.extraction, warnings: [123] },
    }
    expect(OcrResultSchema.safeParse(result).success).toBe(false)
  })
})
