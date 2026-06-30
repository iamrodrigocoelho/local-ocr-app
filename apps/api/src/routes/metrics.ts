import type { FastifyInstance } from 'fastify'
import type { JobStore } from '../services/job-store.js'

export function registerMetricsRoute(server: FastifyInstance, jobStore: JobStore) {
  server.get('/metrics', async (_request, reply) => {
    return reply.send(jobStore.getMetrics())
  })
}
