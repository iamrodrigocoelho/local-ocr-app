import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { config } from './config.js'
import { createSqliteJobStore } from './services/job-store-sqlite.js'
import { createOcrPipeline } from './services/ocr-pipeline.js'
import { createOllamaClient, type OllamaClient } from './adapters/ollama-client.js'
import { createPdfConverter, type PdfConverter } from './adapters/pdf-converter.js'
import { createLlmFieldExtractor, type FieldExtractor } from './adapters/field-extractor.js'
import { registerJobRoutes } from './routes/jobs.js'
import { registerExportRoutes } from './routes/exports.js'
import { registerFieldRoutes } from './routes/fields.js'
import { registerCancelRoute } from './routes/cancel.js'
import { registerBatchRoute } from './routes/batch.js'
import { registerMetricsRoute } from './routes/metrics.js'
import type { JobStore } from './services/job-store.js'

interface ServerOptions {
  ollamaClient?: OllamaClient
  pdfConverter?: PdfConverter
  fieldExtractor?: FieldExtractor
  jobStore?: JobStore
}

export function createServer(opts: ServerOptions = {}) {
  const server = Fastify({
    logger: { level: config.logLevel },
  })

  server.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  })

  server.register(rateLimit, {
    max: 20,
    timeWindow: '1 minute',
  })

  server.register(multipart, {
    limits: { fileSize: config.upload.maxFileSizeBytes },
  })

  const ollamaClient = opts.ollamaClient ?? createOllamaClient()
  const pdfConverter = opts.pdfConverter ?? createPdfConverter()
  const fieldExtractor = opts.fieldExtractor ?? createLlmFieldExtractor({
    endpoint: config.ollama.endpoint,
    model: config.ollama.extractionModel,
    timeoutMs: config.ollama.extractionTimeoutMs,
  })
  const jobStore = opts.jobStore ?? createSqliteJobStore(config.dbPath)
  const pipeline = createOcrPipeline(ollamaClient, pdfConverter, fieldExtractor, jobStore)

  server.get('/health', async () => ({ status: 'ok' }))

  server.register(async (app) => {
    registerJobRoutes(app, jobStore, pipeline)
    registerBatchRoute(app, jobStore, pipeline)
    registerExportRoutes(app, jobStore)
    registerFieldRoutes(app, jobStore)
    registerCancelRoute(app, jobStore)
    registerMetricsRoute(app, jobStore)
  })

  return server
}
