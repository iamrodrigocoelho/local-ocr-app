import { describe, it, expect, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { createJobStore } from '../services/job-store.js'
import { registerCancelRoute } from '../routes/cancel.js'

function buildServer() {
  const app = Fastify({ logger: false })
  const jobStore = createJobStore()
  registerCancelRoute(app, jobStore)
  return { app, jobStore }
}

describe('DELETE /jobs/:id', () => {
  let server: ReturnType<typeof buildServer>['app']
  let jobStore: ReturnType<typeof buildServer>['jobStore']

  beforeEach(() => {
    const built = buildServer()
    server = built.app
    jobStore = built.jobStore
  })

  it('returns 200 and cancels a queued job', async () => {
    const id = jobStore.create('doc.png', 'image/png')
    const res = await server.inject({ method: 'DELETE', url: `/jobs/${id}` })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
    expect(jobStore.get(id)!.status).toBe('canceled')
  })

  it('returns 200 and cancels a processing job', async () => {
    const id = jobStore.create('doc.png', 'image/png')
    jobStore.setProcessing(id, 'Lendo página 1 de 1')
    const res = await server.inject({ method: 'DELETE', url: `/jobs/${id}` })
    expect(res.statusCode).toBe(200)
    expect(jobStore.get(id)!.status).toBe('canceled')
  })

  it('returns 404 for unknown job', async () => {
    const res = await server.inject({ method: 'DELETE', url: '/jobs/non-existent' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 409 for a completed job', async () => {
    const id = jobStore.create('doc.png', 'image/png')
    jobStore.complete(id, { schemaVersion: '1.0', documentId: '00000000-0000-0000-0000-000000000001', source: { filename: 'doc.png', mimeType: 'image/png', sizeBytes: 1, pageCount: 1 }, model: { name: 'm', provider: 'ollama', endpoint: 'http://localhost:11434' }, processing: { status: 'completed', startedAt: null, finishedAt: null, durationMs: null, error: null }, pages: [{ page: 1, transcription: { markdown: '', html: null }, metrics: { inputTokens: 0, outputTokens: 0, evalTokensPerSecond: 0 } }], extraction: { documentType: null, fields: {}, warnings: [] } })
    const res = await server.inject({ method: 'DELETE', url: `/jobs/${id}` })
    expect(res.statusCode).toBe(409)
  })

  it('notifies SSE subscribers with canceled event', async () => {
    const id = jobStore.create('doc.png', 'image/png')
    jobStore.setProcessing(id, 'Lendo página 1 de 1')
    const events: string[] = []
    jobStore.subscribe(id, (e) => events.push(e.type))
    await server.inject({ method: 'DELETE', url: `/jobs/${id}` })
    expect(events).toContain('canceled')
  })
})
