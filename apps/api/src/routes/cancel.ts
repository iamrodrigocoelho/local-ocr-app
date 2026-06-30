import type { FastifyInstance } from 'fastify'
import type { JobStore } from '../services/job-store.js'

export function registerCancelRoute(server: FastifyInstance, jobStore: JobStore) {
  server.delete<{ Params: { id: string } }>('/jobs/:id', async (request, reply) => {
    const job = jobStore.get(request.params.id)
    if (!job) return reply.code(404).send({ error: 'Job não encontrado.' })

    const canceled = jobStore.cancel(request.params.id)
    if (!canceled) {
      return reply.code(409).send({ error: `Job não pode ser cancelado no estado '${job.status}'.` })
    }

    return reply.send({ ok: true })
  })
}
