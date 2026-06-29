import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { config } from './config.js'
import { createJobStore } from './services/job-store.js'
import { createOcrPipeline } from './services/ocr-pipeline.js'
import { createOllamaClient, type OllamaClient } from './adapters/ollama-client.js'
import { createPdfConverter, type PdfConverter } from './adapters/pdf-converter.js'
import { createLlmFieldExtractor, type FieldExtractor } from './adapters/field-extractor.js'
import { registerJobRoutes } from './routes/jobs.js'
import { registerExportRoutes } from './routes/exports.js'
import { registerFieldRoutes } from './routes/fields.js'

interface ServerOptions {
  ollamaClient?: OllamaClient
  pdfConverter?: PdfConverter
  fieldExtractor?: FieldExtractor
}

export function createServer(opts: ServerOptions = {}) {
  const server = Fastify({
    logger: { level: config.logLevel },
  })

  server.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
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
  const jobStore = createJobStore()
  const pipeline = createOcrPipeline(ollamaClient, pdfConverter, fieldExtractor, jobStore)

  server.get('/health', async () => ({ status: 'ok' }))

  server.register(async (app) => {
    registerJobRoutes(app, jobStore, pipeline)
    registerExportRoutes(app, jobStore)
    registerFieldRoutes(app, jobStore)
  })

  return server
}
