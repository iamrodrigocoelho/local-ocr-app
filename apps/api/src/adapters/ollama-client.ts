import { config } from '../config.js'

export interface TranscriptionResult {
  markdown: string
  inputTokens: number
  outputTokens: number
  evalDurationNs: number
}

export interface OllamaClient {
  transcribe(imageBuffer: Buffer, mimeType: string): Promise<TranscriptionResult>
}

interface OllamaChatResponse {
  message: { content: string }
  prompt_eval_count?: number
  eval_count?: number
  eval_duration?: number
}

export function createOllamaClient(): OllamaClient {
  return {
    async transcribe(imageBuffer: Buffer, _mimeType: string): Promise<TranscriptionResult> {
      const base64 = imageBuffer.toString('base64')

      const body = {
        model: config.ollama.model,
        messages: [
          {
            role: 'user',
            content:
              'Transcribe this document completely and accurately. ' +
              'Return the full text preserving structure using markdown (headings, tables, lists). ' +
              'Do not summarize or omit any content.',
            images: [base64],
          },
        ],
        stream: false,
      }

      const res = await fetch(`${config.ollama.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.ollama.timeoutMs),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new OllamaError(`Ollama retornou ${res.status}: ${text}`)
      }

      const data = (await res.json()) as OllamaChatResponse

      return {
        markdown: data.message.content,
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
        evalDurationNs: data.eval_duration ?? 0,
      }
    },
  }
}

export class OllamaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OllamaError'
  }
}
