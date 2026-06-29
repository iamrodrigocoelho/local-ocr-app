import type { ExtractedField } from '@ocr-reader/shared'

export interface ExtractionInput {
  transcription: string
  pageCount: number
}

export interface ExtractionOutput {
  documentType: string | null
  fields: Record<string, ExtractedField>
  warnings: string[]
}

export interface FieldExtractor {
  extract(input: ExtractionInput): Promise<ExtractionOutput>
}

interface FieldExtractorConfig {
  endpoint: string
  model: string
  timeoutMs: number
}

interface OllamaChatResponse {
  message: { content: string }
}

export function createLlmFieldExtractor(cfg: FieldExtractorConfig): FieldExtractor {
  return {
    async extract({ transcription, pageCount }) {
      const prompt = buildPrompt(transcription, pageCount)

      const res = await fetch(`${cfg.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        }),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(`Ollama extração retornou ${res.status}: ${text}`)
      }

      const data = (await res.json()) as OllamaChatResponse
      return parseResponse(data.message.content)
    },
  }
}

function buildPrompt(transcription: string, pageCount: number): string {
  return `Você é um assistente de extração de informações de documentos.

Analise a transcrição OCR abaixo (${pageCount} página${pageCount !== 1 ? 's' : ''}) e extraia as informações estruturadas.

Retorne APENAS um objeto JSON válido, sem texto adicional, sem blocos de código, com a seguinte estrutura:
{
  "documentType": "tipo do documento em inglês (receipt, invoice, form, letter, contract, etc.) ou null",
  "fields": {
    "nomeDocampo": { "value": "valor ou null", "confidence": 0.0, "page": 1 }
  },
  "warnings": ["aviso sobre campos não encontrados"]
}

Extraia todos os campos relevantes para o tipo de documento: datas, valores monetários, nomes, endereços, números de documento, totais, itens, etc. Para campos não encontrados, use value: null e confidence: 0.0.

Transcrição:
${transcription}`
}

function parseResponse(raw: string): ExtractionOutput {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<ExtractionOutput>
    return {
      documentType: parsed.documentType ?? null,
      fields: parsed.fields ?? {},
      warnings: parsed.warnings ?? [],
    }
  } catch {
    return {
      documentType: null,
      fields: {},
      warnings: ['Falha na extração de campos: resposta do modelo inválida.'],
    }
  }
}
