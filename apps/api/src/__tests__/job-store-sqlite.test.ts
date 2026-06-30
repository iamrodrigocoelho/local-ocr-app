import { describe, it, expect, beforeEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unlinkSync } from 'node:fs'
import { createSqliteJobStore } from '../services/job-store-sqlite.js'
import type { JobStore } from '../services/job-store.js'

const MOCK_RESULT = {
  schemaVersion: '1.0',
  documentId: '00000000-0000-0000-0000-000000000001',
  source: { filename: 'test.png', mimeType: 'image/png', sizeBytes: 1024, pageCount: 1 },
  model: { name: 'chandra', provider: 'ollama', endpoint: 'http://localhost:11434' },
  processing: { status: 'completed' as const, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:01:00.000Z', durationMs: 60000, error: null },
  pages: [{ page: 1, transcription: { markdown: '# Test', html: null }, metrics: { inputTokens: 10, outputTokens: 20, evalTokensPerSecond: 1 } }],
  extraction: { documentType: null, fields: {}, warnings: [] },
}

let store: JobStore

beforeEach(() => {
  store = createSqliteJobStore(':memory:')
})

describe('SqliteJobStore — basic CRUD', () => {
  it('create returns a UUID and get retrieves it', () => {
    const id = store.create('doc.png', 'image/png')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    const job = store.get(id)
    expect(job).toBeDefined()
    expect(job!.status).toBe('queued')
    expect(job!.filename).toBe('doc.png')
    expect(job!.mimeType).toBe('image/png')
  })

  it('get returns undefined for unknown id', () => {
    expect(store.get('non-existent')).toBeUndefined()
  })

  it('list returns all jobs', () => {
    const id1 = store.create('a.png', 'image/png')
    const id2 = store.create('b.png', 'image/png')
    const jobs = store.list()
    expect(jobs).toHaveLength(2)
    expect(jobs.map((j) => j.id)).toEqual(expect.arrayContaining([id1, id2]))
  })

  it('setProcessing updates status and step', () => {
    const id = store.create('doc.png', 'image/png')
    store.setProcessing(id, 'Lendo página 1 de 1')
    const job = store.get(id)!
    expect(job.status).toBe('processing')
    expect(job.step).toBe('Lendo página 1 de 1')
    expect(job.startedAt).toBeTruthy()
  })

  it('complete stores the full OcrResult', () => {
    const id = store.create('doc.png', 'image/png')
    store.complete(id, MOCK_RESULT)
    const job = store.get(id)!
    expect(job.status).toBe('completed')
    expect(job.result).toBeDefined()
    expect(job.result!.pages[0].transcription.markdown).toBe('# Test')
  })

  it('fail stores the error message', () => {
    const id = store.create('doc.png', 'image/png')
    store.fail(id, 'connection refused')
    const job = store.get(id)!
    expect(job.status).toBe('failed')
    expect(job.error).toBe('connection refused')
    expect(job.finishedAt).toBeTruthy()
  })
})

describe('SqliteJobStore — cancel', () => {
  it('cancel returns true and sets status to canceled', () => {
    const id = store.create('doc.png', 'image/png')
    store.setProcessing(id, 'Lendo página 1 de 1')
    const ok = store.cancel(id)
    expect(ok).toBe(true)
    expect(store.get(id)!.status).toBe('canceled')
  })

  it('cancel returns false for unknown job', () => {
    expect(store.cancel('non-existent')).toBe(false)
  })

  it('cancel returns false for completed job', () => {
    const id = store.create('doc.png', 'image/png')
    store.complete(id, MOCK_RESULT)
    expect(store.cancel(id)).toBe(false)
    expect(store.get(id)!.status).toBe('completed')
  })
})

describe('SqliteJobStore — updateFields', () => {
  it('updateFields updates extraction data', () => {
    const id = store.create('doc.png', 'image/png')
    store.complete(id, MOCK_RESULT)
    const ok = store.updateFields(id, 'receipt', { total: { value: 45.8, confidence: 0.9, page: 1 } })
    expect(ok).toBe(true)
    const job = store.get(id)!
    expect(job.result!.extraction.documentType).toBe('receipt')
    expect(job.result!.extraction.fields['total'].value).toBe(45.8)
  })

  it('updateFields returns false for job without result', () => {
    const id = store.create('doc.png', 'image/png')
    expect(store.updateFields(id, null, {})).toBe(false)
  })
})

describe('SqliteJobStore — getMetrics', () => {
  it('returns zeros when no jobs exist', () => {
    const m = store.getMetrics()
    expect(m.total).toBe(0)
    expect(m.avgDurationMs).toBeNull()
    expect(m.errorRate).toBe(0)
  })

  it('counts jobs by status', () => {
    store.create('a.png', 'image/png')
    const id2 = store.create('b.png', 'image/png')
    store.complete(id2, MOCK_RESULT)
    const m = store.getMetrics()
    expect(m.total).toBe(2)
    expect(m.byStatus.queued).toBe(1)
    expect(m.byStatus.completed).toBe(1)
  })

  it('computes errorRate', () => {
    const id1 = store.create('a.png', 'image/png')
    store.fail(id1, 'err')
    const id2 = store.create('b.png', 'image/png')
    store.complete(id2, MOCK_RESULT)
    const m = store.getMetrics()
    expect(m.errorRate).toBeCloseTo(0.5)
  })
})

describe('SqliteJobStore — persistence', () => {
  it('data created in one instance is visible in another (shared path)', () => {
    const tmp = join(tmpdir(), `ocr-test-${Date.now()}.json`)
    try {
      const storeA = createSqliteJobStore(tmp)
      const id = storeA.create('doc.png', 'image/png')
      storeA.complete(id, MOCK_RESULT)

      const storeB = createSqliteJobStore(tmp)
      const job = storeB.get(id)
      expect(job).toBeDefined()
      expect(job!.status).toBe('completed')
    } finally {
      try { unlinkSync(tmp) } catch { /* ignore */ }
    }
  })
})
