import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOcrPipeline } from '../services/ocr-pipeline.js'
import type { OllamaClient } from '../adapters/ollama-client.js'
import type { PdfConverter } from '../adapters/pdf-converter.js'
import type { JobStore } from '../services/job-store.js'

const PNG_BUFFER = (() => {
  const buf = Buffer.alloc(64)
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47
  buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a
  return buf
})()

const PDF_BUFFER = (() => {
  const buf = Buffer.alloc(64)
  buf[0] = 0x25; buf[1] = 0x50; buf[2] = 0x44; buf[3] = 0x46 // %PDF
  return buf
})()

const MOCK_TRANSCRIPTION = {
  markdown: '## Recibo\nTotal: R$ 45,80',
  inputTokens: 271,
  outputTokens: 1099,
  evalDurationNs: 233_617_000_000,
}

function makeMocks() {
  const ollama: OllamaClient = {
    transcribe: vi.fn().mockResolvedValue(MOCK_TRANSCRIPTION),
  }
  const pdfConverter: PdfConverter = {
    toImages: vi.fn().mockResolvedValue([PNG_BUFFER]),
  }
  const jobStore: JobStore = {
    create: vi.fn().mockReturnValue('job-1'),
    get: vi.fn(),
    setProcessing: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
    notify: vi.fn(),
  }
  return { ollama, pdfConverter, jobStore }
}

describe('ocrPipeline.run — image', () => {
  let mocks: ReturnType<typeof makeMocks>
  beforeEach(() => { mocks = makeMocks() })

  it('calls ollama.transcribe with the image buffer directly', async () => {
    const pipeline = createOcrPipeline(mocks.ollama, mocks.pdfConverter, mocks.jobStore)
    await pipeline.run('job-1', PNG_BUFFER, 'image/png', 'doc.png')

    expect(mocks.ollama.transcribe).toHaveBeenCalledWith(PNG_BUFFER, 'image/png')
    expect(mocks.pdfConverter.toImages).not.toHaveBeenCalled()
  })

  it('does NOT call pdfConverter for image uploads', async () => {
    const pipeline = createOcrPipeline(mocks.ollama, mocks.pdfConverter, mocks.jobStore)
    await pipeline.run('job-1', PNG_BUFFER, 'image/png', 'doc.png')
    expect(mocks.pdfConverter.toImages).not.toHaveBeenCalled()
  })

  it('transitions job: setProcessing → complete', async () => {
    const pipeline = createOcrPipeline(mocks.ollama, mocks.pdfConverter, mocks.jobStore)
    await pipeline.run('job-1', PNG_BUFFER, 'image/png', 'doc.png')

    expect(mocks.jobStore.setProcessing).toHaveBeenCalled()
    expect(mocks.jobStore.complete).toHaveBeenCalledWith('job-1', expect.objectContaining({
      schemaVersion: '1.0',
      processing: expect.objectContaining({ status: 'completed' }),
    }))
  })

  it('builds OcrResult with one page and correct metrics', async () => {
    const pipeline = createOcrPipeline(mocks.ollama, mocks.pdfConverter, mocks.jobStore)
    await pipeline.run('job-1', PNG_BUFFER, 'image/png', 'doc.png')

    const [, result] = (mocks.jobStore.complete as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].transcription.markdown).toBe(MOCK_TRANSCRIPTION.markdown)
    expect(result.pages[0].metrics.inputTokens).toBe(271)
    expect(result.extraction.fields).toEqual({})
  })

  it('marks job as failed when Ollama throws', async () => {
    mocks.ollama.transcribe = vi.fn().mockRejectedValue(new Error('connection refused'))
    const pipeline = createOcrPipeline(mocks.ollama, mocks.pdfConverter, mocks.jobStore)
    await pipeline.run('job-1', PNG_BUFFER, 'image/png', 'doc.png')

    expect(mocks.jobStore.fail).toHaveBeenCalledWith('job-1', expect.stringContaining('connection refused'))
    expect(mocks.jobStore.complete).not.toHaveBeenCalled()
  })
})

describe('ocrPipeline.run — PDF', () => {
  let mocks: ReturnType<typeof makeMocks>
  beforeEach(() => { mocks = makeMocks() })

  it('calls pdfConverter.toImages with the PDF buffer', async () => {
    const pipeline = createOcrPipeline(mocks.ollama, mocks.pdfConverter, mocks.jobStore)
    await pipeline.run('job-1', PDF_BUFFER, 'application/pdf', 'doc.pdf')

    expect(mocks.pdfConverter.toImages).toHaveBeenCalledWith(PDF_BUFFER)
  })

  it('calls ollama.transcribe once per page', async () => {
    const page2 = Buffer.alloc(64)
    mocks.pdfConverter.toImages = vi.fn().mockResolvedValue([PNG_BUFFER, page2])
    mocks.ollama.transcribe = vi.fn()
      .mockResolvedValueOnce({ ...MOCK_TRANSCRIPTION, markdown: 'Página 1' })
      .mockResolvedValueOnce({ ...MOCK_TRANSCRIPTION, markdown: 'Página 2' })

    const pipeline = createOcrPipeline(mocks.ollama, mocks.pdfConverter, mocks.jobStore)
    await pipeline.run('job-1', PDF_BUFFER, 'application/pdf', 'doc.pdf')

    expect(mocks.ollama.transcribe).toHaveBeenCalledTimes(2)
  })

  it('builds OcrResult with one entry per PDF page', async () => {
    const page2 = Buffer.alloc(64)
    mocks.pdfConverter.toImages = vi.fn().mockResolvedValue([PNG_BUFFER, page2])
    mocks.ollama.transcribe = vi.fn()
      .mockResolvedValueOnce({ ...MOCK_TRANSCRIPTION, markdown: 'Página 1' })
      .mockResolvedValueOnce({ ...MOCK_TRANSCRIPTION, markdown: 'Página 2' })

    const pipeline = createOcrPipeline(mocks.ollama, mocks.pdfConverter, mocks.jobStore)
    await pipeline.run('job-1', PDF_BUFFER, 'application/pdf', 'doc.pdf')

    const [, result] = (mocks.jobStore.complete as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(result.pages).toHaveLength(2)
    expect(result.pages[0].transcription.markdown).toBe('Página 1')
    expect(result.pages[1].transcription.markdown).toBe('Página 2')
    expect(result.source.pageCount).toBe(2)
  })

  it('marks job as failed when PDF conversion throws', async () => {
    mocks.pdfConverter.toImages = vi.fn().mockRejectedValue(new Error('PDF corrompido'))
    const pipeline = createOcrPipeline(mocks.ollama, mocks.pdfConverter, mocks.jobStore)
    await pipeline.run('job-1', PDF_BUFFER, 'application/pdf', 'doc.pdf')

    expect(mocks.jobStore.fail).toHaveBeenCalledWith('job-1', expect.stringContaining('PDF corrompido'))
  })
})
