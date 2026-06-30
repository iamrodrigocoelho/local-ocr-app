import type { FastifyInstance } from 'fastify'
import { validateUpload, ValidationError } from '../validation/upload.js'
import type { JobStore } from '../services/job-store.js'
import type { OcrPipeline } from '../services/ocr-pipeline.js'
import { config } from '../config.js'

export function registerJobRoutes(
  server: FastifyInstance,
  jobStore: JobStore,
  pipeline: OcrPipeline,
) {
  server.post('/jobs', async (request, reply) => {
    const data = await request.file()

    if (!data) {
      return reply.code(400).send({ error: 'Nenhum arquivo enviado.' })
    }

    const buffer = await data.toBuffer()
    const filename = data.filename || 'upload'

    let validationResult: ReturnType<typeof validateUpload>
    try {
      validationResult = validateUpload(buffer)
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(422).send({ error: err.message, code: err.code })
      }
      throw err
    }

    const jobId = jobStore.create(filename, validationResult.mimeType)

    // Fire-and-forget: pipeline runs async, SSE pushes progress to clients
    pipeline.run(jobId, buffer, validationResult.mimeType, filename).catch(() => {})

    return reply.code(201).send({ jobId, status: 'queued' })
  })

  server.get<{ Params: { id: string } }>('/jobs/:id', async (request, reply) => {
    const job = jobStore.get(request.params.id)
    if (!job) return reply.code(404).send({ error: 'Job não encontrado.' })

    return reply.send({
      jobId: job.id,
      status: job.status,
      step: job.step ?? null,
      result: job.result ?? null,
      error: job.error ?? null,
      createdAt: job.createdAt,
      startedAt: job.startedAt ?? null,
      finishedAt: job.finishedAt ?? null,
    })
  })

  server.get<{ Params: { id: string } }>('/jobs/:id/events', async (request, reply) => {
    const job = jobStore.get(request.params.id)
    if (!job) return reply.code(404).send({ error: 'Job não encontrado.' })

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': config.corsOrigin,
    })

    const send = (data: object) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // If job already finished, send one event and close immediately
    if (job.status === 'completed' && job.result) {
      send({ type: 'completed', result: job.result })
      reply.raw.end()
      return reply
    }
    if (job.status === 'failed') {
      send({ type: 'failed', error: job.error })
      reply.raw.end()
      return reply
    }
    if (job.status === 'canceled') {
      send({ type: 'canceled' })
      reply.raw.end()
      return reply
    }

    // Send current step if already processing
    if (job.status === 'processing') {
      send({ type: 'status', status: 'processing', step: job.step })
    }

    const unsubscribe = jobStore.subscribe(request.params.id, (event) => {
      send(event)
      if (event.type === 'completed' || event.type === 'failed' || event.type === 'canceled') {
        reply.raw.end()
      }
    })

    request.raw.on('close', unsubscribe)

    return reply
  })
}
