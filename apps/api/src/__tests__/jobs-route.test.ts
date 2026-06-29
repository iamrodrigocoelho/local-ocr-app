import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createServer } from '../server.js'
import type { FastifyInstance } from 'fastify'
import type { OllamaClient } from '../adapters/ollama-client.js'

const PNG_BUFFER = (() => {
  const buf = Buffer.alloc(512)
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47
  buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a
  return buf
})()

const MOCK_OLLAMA: OllamaClient = {
  transcribe: vi.fn().mockResolvedValue({
    markdown: '## Test\nContent',
    inputTokens: 100,
    outputTokens: 200,
    evalDurationNs: 1_000_000_000,
  }),
}

function buildMultipartBody(buffer: Buffer, filename: string, mimeType: string) {
  const boundary = '----TestBoundary'
  const header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mimeType}`,
    '',
    '',
  ].join('\r\n')
  const footer = `\r\n--${boundary}--\r\n`
  return {
    body: Buffer.concat([Buffer.from(header), buffer, Buffer.from(footer)]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

describe('POST /jobs', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = createServer({ ollamaClient: MOCK_OLLAMA })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 201 with jobId when a valid PNG is uploaded', async () => {
    const { body, contentType } = buildMultipartBody(PNG_BUFFER, 'test.png', 'image/png')
    const res = await app.inject({
      method: 'POST',
      url: '/jobs',
      headers: { 'content-type': contentType },
      body,
    })
    expect(res.statusCode).toBe(201)
    const json = res.json()
    expect(json.jobId).toBeTruthy()
    expect(json.status).toBe('queued')
  })

  it('returns 400 when no file is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/jobs',
      headers: { 'content-type': 'multipart/form-data; boundary=----Empty' },
      body: '------Empty--\r\n',
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 422 when file type is not supported', async () => {
    const badBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
    const { body, contentType } = buildMultipartBody(badBuffer, 'file.exe', 'application/octet-stream')
    const res = await app.inject({
      method: 'POST',
      url: '/jobs',
      headers: { 'content-type': contentType },
      body,
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('GET /jobs/:id', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = createServer({ ollamaClient: MOCK_OLLAMA })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 404 for an unknown job id', async () => {
    const res = await app.inject({ method: 'GET', url: '/jobs/non-existent-id' })
    expect(res.statusCode).toBe(404)
  })

  it('returns the job status for a known job', async () => {
    const { body, contentType } = buildMultipartBody(PNG_BUFFER, 'img.png', 'image/png')
    const postRes = await app.inject({
      method: 'POST',
      url: '/jobs',
      headers: { 'content-type': contentType },
      body,
    })
    const { jobId } = postRes.json()

    const getRes = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    expect(getRes.statusCode).toBe(200)
    expect(['queued', 'processing', 'completed', 'failed']).toContain(getRes.json().status)
  })
})
