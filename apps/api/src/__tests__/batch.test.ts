import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import { createJobStore } from '../services/job-store.js'
import { registerBatchRoute } from '../routes/batch.js'
import type { OcrPipeline } from '../services/ocr-pipeline.js'
import { MAX_FILE_SIZE_BYTES } from '../validation/upload.js'

const PNG_BUFFER = (() => {
  const buf = Buffer.alloc(16)
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47
  buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a
  return buf
})()

function buildServer() {
  const app = Fastify({ logger: false })
  app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE_BYTES } })
  const jobStore = createJobStore()
  const pipeline: OcrPipeline = { run: vi.fn().mockResolvedValue(undefined) }
  registerBatchRoute(app, jobStore, pipeline)
  return { app, jobStore, pipeline }
}

async function makeFormData(files: Array<{ name: string; buffer: Buffer; mimeType: string }>) {
  const boundary = '----TestBoundary'
  const parts: Buffer[] = []
  for (const f of files) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="files[]"; filename="${f.name}"\r\nContent-Type: ${f.mimeType}\r\n\r\n`
    ))
    parts.push(f.buffer)
    parts.push(Buffer.from('\r\n'))
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`))
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` }
}

describe('POST /jobs/batch', () => {
  let server: ReturnType<typeof buildServer>['app']
  let _jobStore: ReturnType<typeof buildServer>['jobStore']
  let pipeline: ReturnType<typeof buildServer>['pipeline']

  beforeEach(() => {
    const built = buildServer()
    server = built.app
    _jobStore = built.jobStore
    pipeline = built.pipeline
  })

  it('creates one job per file and returns array of jobIds', async () => {
    const { body, contentType } = await makeFormData([
      { name: 'a.png', buffer: PNG_BUFFER, mimeType: 'image/png' },
      { name: 'b.png', buffer: PNG_BUFFER, mimeType: 'image/png' },
    ])
    const res = await server.inject({
      method: 'POST', url: '/jobs/batch',
      payload: body,
      headers: { 'content-type': contentType },
    })
    expect(res.statusCode).toBe(201)
    const parsed = JSON.parse(res.body) as { jobs: Array<{ jobId: string; filename: string; status: string }> }
    expect(parsed.jobs).toHaveLength(2)
    expect(parsed.jobs[0].status).toBe('queued')
    expect(parsed.jobs.map((j) => j.filename)).toEqual(expect.arrayContaining(['a.png', 'b.png']))
  })

  it('fires the pipeline once per valid file', async () => {
    const { body, contentType } = await makeFormData([
      { name: 'a.png', buffer: PNG_BUFFER, mimeType: 'image/png' },
      { name: 'b.png', buffer: PNG_BUFFER, mimeType: 'image/png' },
    ])
    await server.inject({
      method: 'POST', url: '/jobs/batch',
      payload: body,
      headers: { 'content-type': contentType },
    })
    expect(pipeline.run).toHaveBeenCalledTimes(2)
  })

  it('returns 400 when no files are sent', async () => {
    const { body, contentType } = await makeFormData([])
    const res = await server.inject({
      method: 'POST', url: '/jobs/batch',
      payload: body,
      headers: { 'content-type': contentType },
    })
    expect(res.statusCode).toBe(400)
  })

  it('skips files with invalid type and still processes valid ones', async () => {
    const textBuf = Buffer.from('hello world')
    const { body, contentType } = await makeFormData([
      { name: 'doc.txt', buffer: textBuf, mimeType: 'text/plain' },
      { name: 'ok.png', buffer: PNG_BUFFER, mimeType: 'image/png' },
    ])
    const res = await server.inject({
      method: 'POST', url: '/jobs/batch',
      payload: body,
      headers: { 'content-type': contentType },
    })
    expect(res.statusCode).toBe(201)
    const parsed = JSON.parse(res.body) as { jobs: unknown[]; errors: unknown[] }
    expect(parsed.jobs).toHaveLength(1)
    expect(parsed.errors).toHaveLength(1)
  })
})
