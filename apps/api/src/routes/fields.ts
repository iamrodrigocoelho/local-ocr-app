import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ExtractedFieldSchema } from '@ocr-reader/shared'
import type { JobStore } from '../services/job-store.js'

const PatchFieldsBodySchema = z.object({
  documentType: z.string().nullable().optional(),
  fields: z.record(z.string(), ExtractedFieldSchema),
})

export function registerFieldRoutes(server: FastifyInstance, jobStore: JobStore) {
  server.patch<{ Params: { id: string } }>(
    '/jobs/:id/fields',
    async (request, reply) => {
      const job = jobStore.get(request.params.id)
      if (!job) return reply.code(404).send({ error: 'Job não encontrado.' })
      if (job.status !== 'completed') {
        return reply.code(409).send({ error: 'Job ainda não concluído.' })
      }

      const parsed = PatchFieldsBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Corpo inválido.', details: parsed.error.flatten() })
      }

      const { documentType = job.result?.extraction.documentType ?? null, fields } = parsed.data
      jobStore.updateFields(request.params.id, documentType, fields)

      return reply.send({ ok: true })
    },
  )
}
