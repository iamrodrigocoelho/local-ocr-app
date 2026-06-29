import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLlmFieldExtractor, type ExtractionOutput } from '../adapters/field-extractor.js'

const MOCK_TRANSCRIPTION = `## Mercado X
| Item | Valor |
|---|---|
| Café | 12,90 |
| Pão | 3,50 |
**Total: R$ 45,80**
Data: 28/06/2026`

const VALID_RESPONSE: ExtractionOutput = {
  documentType: 'receipt',
  fields: {
    estabelecimento: { value: 'Mercado X', confidence: 0.97, page: 1 },
    data: { value: '2026-06-28', confidence: 0.9, page: 1 },
    valorTotal: { value: 45.8, confidence: 0.93, page: 1 },
    formaPagamento: { value: null, confidence: 0.0, page: 1 },
  },
  warnings: ["Campo 'formaPagamento' não localizado"],
}

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

function makeOllamaResponse(content: string) {
  return {
    ok: true,
    json: async () => ({ message: { content } }),
  }
}

describe('LlmFieldExtractor', () => {
  it('calls Ollama with the transcription and returns parsed fields', async () => {
    mockFetch.mockResolvedValueOnce(makeOllamaResponse(JSON.stringify(VALID_RESPONSE)))

    const extractor = createLlmFieldExtractor({
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
      timeoutMs: 60000,
    })

    const result = await extractor.extract({ transcription: MOCK_TRANSCRIPTION, pageCount: 1 })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('http://localhost:11434/api/chat')
    const body = JSON.parse(init.body) as { model: string; messages: Array<{ role: string; content: string }> }
    expect(body.model).toBe('llama3.2')
    expect(body.messages[0].content).toContain(MOCK_TRANSCRIPTION)

    expect(result.documentType).toBe('receipt')
    expect(result.fields['estabelecimento'].value).toBe('Mercado X')
    expect(result.fields['valorTotal'].value).toBe(45.8)
    expect(result.warnings).toEqual(["Campo 'formaPagamento' não localizado"])
  })

  it('strips markdown fences from the model response before parsing', async () => {
    const withFences = `\`\`\`json\n${JSON.stringify(VALID_RESPONSE)}\n\`\`\``
    mockFetch.mockResolvedValueOnce(makeOllamaResponse(withFences))

    const extractor = createLlmFieldExtractor({
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
      timeoutMs: 60000,
    })

    const result = await extractor.extract({ transcription: MOCK_TRANSCRIPTION, pageCount: 1 })
    expect(result.documentType).toBe('receipt')
    expect(result.fields['data'].value).toBe('2026-06-28')
  })

  it('returns empty fields and a warning when the model returns invalid JSON', async () => {
    mockFetch.mockResolvedValueOnce(makeOllamaResponse('Desculpe, não consigo processar isso.'))

    const extractor = createLlmFieldExtractor({
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
      timeoutMs: 60000,
    })

    const result = await extractor.extract({ transcription: MOCK_TRANSCRIPTION, pageCount: 1 })
    expect(result.documentType).toBeNull()
    expect(result.fields).toEqual({})
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/extração/)
  })

  it('throws when Ollama returns a non-ok HTTP status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
      statusText: 'Internal Server Error',
    })

    const extractor = createLlmFieldExtractor({
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
      timeoutMs: 60000,
    })

    await expect(
      extractor.extract({ transcription: MOCK_TRANSCRIPTION, pageCount: 1 }),
    ).rejects.toThrow('500')
  })

  it('returns null documentType when the model omits it', async () => {
    const noType = { ...VALID_RESPONSE, documentType: null }
    mockFetch.mockResolvedValueOnce(makeOllamaResponse(JSON.stringify(noType)))

    const extractor = createLlmFieldExtractor({
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
      timeoutMs: 60000,
    })

    const result = await extractor.extract({ transcription: MOCK_TRANSCRIPTION, pageCount: 1 })
    expect(result.documentType).toBeNull()
  })

  it('returns empty fields and no warnings for an empty transcription', async () => {
    const emptyResponse: ExtractionOutput = { documentType: null, fields: {}, warnings: [] }
    mockFetch.mockResolvedValueOnce(makeOllamaResponse(JSON.stringify(emptyResponse)))

    const extractor = createLlmFieldExtractor({
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
      timeoutMs: 60000,
    })

    const result = await extractor.extract({ transcription: '', pageCount: 1 })
    expect(result.fields).toEqual({})
    expect(result.warnings).toEqual([])
  })
})
