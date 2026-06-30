import type { FastifyInstance } from 'fastify'
import { validateUpload, ValidationError } from '../validation/upload.js'
import type { JobStore } from '../services/job-store.js'
import type { OcrPipeline } from '../services/ocr-pipeline.js'

export function registerBatchRoute(
  server: FastifyInstance,
  jobStore: JobStore,
  pipeline: OcrPipeline,
) {
  server.post('/jobs/batch', async (request, reply) => {
    const jobs: Array<{ jobId: string; filename: string; status: string }> = []
    const errors: Array<{ filename: string; error: string }> = []

    for await (const part of request.files()) {
      if (part.type !== 'file') continue

      const buffer = await part.toBuffer()
      const filename = part.filename || 'upload'

      let mimeType: string
      try {
        const validated = validateUpload(buffer)
        mimeType = validated.mimeType
      } catch (err) {
        errors.push({
          filename,
          error: err instanceof ValidationError ? err.message : 'Arquivo inválido.',
        })
        continue
      }

      const jobId = jobStore.create(filename, mimeType)
      pipeline.run(jobId, buffer, mimeType, filename).catch(() => {})
      jobs.push({ jobId, filename, status: 'queued' })
    }

    if (jobs.length === 0 && errors.length === 0) {
      return reply.code(400).send({ error: 'Nenhum arquivo enviado.' })
    }

    if (jobs.length === 0) {
      return reply.code(400).send({ error: 'Nenhum arquivo válido.', errors })
    }

    return reply.code(201).send({ jobs, errors })
  })
}
