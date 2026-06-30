import { randomUUID } from 'crypto'
import { OcrResultSchema } from '@ocr-reader/shared'
import type { OllamaClient } from '../adapters/ollama-client.js'
import type { PdfConverter } from '../adapters/pdf-converter.js'
import type { FieldExtractor } from '../adapters/field-extractor.js'
import type { JobStore } from './job-store.js'
import { config } from '../config.js'

export interface OcrPipeline {
  run(jobId: string, buffer: Buffer, mimeType: string, filename: string): Promise<void>
}

export function createOcrPipeline(
  ollama: OllamaClient,
  pdfConverter: PdfConverter,
  fieldExtractor: FieldExtractor,
  jobStore: JobStore,
): OcrPipeline {
  return {
    async run(jobId, buffer, mimeType, filename) {
      try {
        let pageBuffers: Array<{ buffer: Buffer; mimeType: string }>

        if (mimeType === 'application/pdf') {
          jobStore.setProcessing(jobId, 'Convertendo PDF para imagens')
          const images = await pdfConverter.toImages(buffer)
          pageBuffers = images.map((img) => ({ buffer: img, mimeType: 'image/png' }))
        } else {
          pageBuffers = [{ buffer, mimeType }]
        }

        const startedAt = new Date().toISOString()
        const pageResults = []

        for (let i = 0; i < pageBuffers.length; i++) {
          if (jobStore.get(jobId)?.status === 'canceled') return

          const { buffer: pageBuffer, mimeType: pageMimeType } = pageBuffers[i]
          jobStore.setProcessing(jobId, `Lendo página ${i + 1} de ${pageBuffers.length}`)

          const transcription = await ollama.transcribe(pageBuffer, pageMimeType)

          const evalTokensPerSecond =
            transcription.evalDurationNs > 0
              ? transcription.outputTokens / (transcription.evalDurationNs / 1e9)
              : 0

          pageResults.push({
            page: i + 1,
            transcription: { markdown: transcription.markdown, html: null },
            metrics: {
              inputTokens: transcription.inputTokens,
              outputTokens: transcription.outputTokens,
              evalTokensPerSecond,
            },
          })
        }

        if (jobStore.get(jobId)?.status === 'canceled') return

        // Field extraction step
        jobStore.setProcessing(jobId, 'Extraindo campos')
        const fullTranscription = pageResults.map((p) => p.transcription.markdown).join('\n\n')
        const extraction = await fieldExtractor.extract({
          transcription: fullTranscription,
          pageCount: pageResults.length,
        })

        jobStore.setProcessing(jobId, 'Montando resultado')
        const finishedAt = new Date().toISOString()

        const result = OcrResultSchema.parse({
          schemaVersion: '1.0',
          documentId: randomUUID(),
          source: {
            filename,
            mimeType,
            sizeBytes: buffer.length,
            pageCount: pageResults.length,
          },
          model: {
            name: config.ollama.model,
            provider: 'ollama',
            endpoint: config.ollama.endpoint,
          },
          processing: {
            status: 'completed',
            startedAt,
            finishedAt,
            durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
            error: null,
          },
          pages: pageResults,
          extraction,
        })

        jobStore.complete(jobId, result)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        jobStore.fail(jobId, message)
      }
    },
  }
}
