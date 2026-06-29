import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted; must use factory to avoid import-before-mock issues
vi.mock('pdf-to-img', () => ({ default: vi.fn() }))

import pdf from 'pdf-to-img'
import { createPdfConverter, PdfConversionError } from '../adapters/pdf-converter.js'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(56).fill(0)])
const PDF_BUFFER = Buffer.from('%PDF-1.4 minimal')

function makeAsyncIterable<T>(...items: T[]) {
  return (async function* () {
    for (const item of items) yield item
  })()
}

describe('PdfConverter.toImages', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns one Buffer per yielded page', async () => {
    vi.mocked(pdf).mockResolvedValue(makeAsyncIterable(PNG_MAGIC) as never)

    const converter = createPdfConverter()
    const result = await converter.toImages(PDF_BUFFER)

    expect(result).toHaveLength(1)
    expect(result[0]).toBe(PNG_MAGIC)
  })

  it('returns N buffers for an N-page document', async () => {
    const page2 = Buffer.alloc(64, 0x89)
    vi.mocked(pdf).mockResolvedValue(makeAsyncIterable(PNG_MAGIC, page2) as never)

    const converter = createPdfConverter()
    const result = await converter.toImages(PDF_BUFFER)

    expect(result).toHaveLength(2)
    expect(result[1]).toBe(page2)
  })

  it('passes the buffer to pdf-to-img', async () => {
    vi.mocked(pdf).mockResolvedValue(makeAsyncIterable(PNG_MAGIC) as never)

    const converter = createPdfConverter()
    await converter.toImages(PDF_BUFFER)

    expect(vi.mocked(pdf)).toHaveBeenCalledWith(PDF_BUFFER, expect.objectContaining({ scale: expect.any(Number) }))
  })

  it('throws PdfConversionError when pdf-to-img rejects', async () => {
    vi.mocked(pdf).mockRejectedValue(new Error('corrupt PDF'))

    const converter = createPdfConverter()
    await expect(converter.toImages(PDF_BUFFER)).rejects.toBeInstanceOf(PdfConversionError)
  })

  it('throws PdfConversionError when PDF has no pages', async () => {
    vi.mocked(pdf).mockResolvedValue(makeAsyncIterable() as never)

    const converter = createPdfConverter()
    await expect(converter.toImages(PDF_BUFFER)).rejects.toBeInstanceOf(PdfConversionError)
  })
})
