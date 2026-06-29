import { z } from 'zod'

const ProcessingStatusSchema = z.enum([
  'queued',
  'processing',
  'completed',
  'failed',
  'canceled',
])

const SourceSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  pageCount: z.number().int().positive(),
})

const ModelSchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1),
  endpoint: z.string().url(),
})

const ProcessingSchema = z.object({
  status: ProcessingStatusSchema,
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().nonnegative().nullable(),
  error: z.string().nullable(),
})

const TranscriptionSchema = z.object({
  markdown: z.string(),
  html: z.string().nullable(),
})

const PageMetricsSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  evalTokensPerSecond: z.number().nonnegative(),
})

const PageSchema = z.object({
  page: z.number().int().positive(),
  transcription: TranscriptionSchema,
  metrics: PageMetricsSchema,
})

export const ExtractedFieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number().min(0).max(1),
  page: z.number().int().positive(),
})

const ExtractionSchema = z.object({
  documentType: z.string().nullable(),
  fields: z.record(z.string(), ExtractedFieldSchema),
  warnings: z.array(z.string()),
})

export const OcrResultSchema = z.object({
  schemaVersion: z.string().min(1),
  documentId: z.string().uuid(),
  source: SourceSchema,
  model: ModelSchema,
  processing: ProcessingSchema,
  pages: z.array(PageSchema).min(1),
  extraction: ExtractionSchema,
})

export type OcrResult = z.infer<typeof OcrResultSchema>
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>
export type OcrPage = z.infer<typeof PageSchema>
