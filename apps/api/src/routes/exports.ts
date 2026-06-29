import type { FastifyInstance } from 'fastify'
import { toJson, toCsv, toExcel } from '../adapters/exporters.js'
import type { JobStore } from '../services/job-store.js'

const FORMATS = ['json', 'csv', 'xlsx'] as const
type ExportFormat = (typeof FORMATS)[number]

export function registerExportRoutes(server: FastifyInstance, jobStore: JobStore) {
  server.get<{ Params: { id: string; format: string } }>(
    '/jobs/:id/export/:format',
    async (request, reply) => {
      const { id, format } = request.params

      if (!FORMATS.includes(format as ExportFormat)) {
        return reply.code(400).send({ error: `Formato inválido. Use: ${FORMATS.join(', ')}.` })
      }

      const job = jobStore.get(id)
      if (!job) return reply.code(404).send({ error: 'Job não encontrado.' })
      if (job.status !== 'completed' || !job.result) {
        return reply.code(409).send({ error: 'Job ainda não concluído.' })
      }

      const basename = job.filename.replace(/\.[^.]+$/, '') || 'resultado'

      switch (format as ExportFormat) {
        case 'json': {
          reply.header('Content-Type', 'application/json; charset=utf-8')
          reply.header('Content-Disposition', `attachment; filename="${basename}.json"`)
          return reply.send(toJson(job.result))
        }
        case 'csv': {
          reply.header('Content-Type', 'text/csv; charset=utf-8')
          reply.header('Content-Disposition', `attachment; filename="${basename}.csv"`)
          return reply.send(toCsv(job.result))
        }
        case 'xlsx': {
          const buffer = await toExcel(job.result)
          reply.header(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
          reply.header('Content-Disposition', `attachment; filename="${basename}.xlsx"`)
          return reply.send(buffer)
        }
      }
    },
  )
}
