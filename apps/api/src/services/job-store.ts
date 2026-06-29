import type { OcrResult } from '@ocr-reader/shared'

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface JobEvent {
  type: 'status' | 'completed' | 'failed'
  status?: JobStatus
  step?: string
  result?: OcrResult
  error?: string
}

export interface JobRecord {
  id: string
  status: JobStatus
  filename: string
  mimeType: string
  step?: string
  result?: OcrResult
  error?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

export interface JobStore {
  create(filename: string, mimeType: string): string
  get(id: string): JobRecord | undefined
  setProcessing(id: string, step: string): void
  complete(id: string, result: OcrResult): void
  fail(id: string, error: string): void
  subscribe(id: string, listener: (event: JobEvent) => void): () => void
  notify(id: string, event: JobEvent): void
}

export function createJobStore(): JobStore {
  const jobs = new Map<string, JobRecord>()
  const subscribers = new Map<string, Set<(event: JobEvent) => void>>()

  return {
    create(filename, mimeType) {
      const id = crypto.randomUUID()
      jobs.set(id, {
        id,
        status: 'queued',
        filename,
        mimeType,
        createdAt: new Date().toISOString(),
      })
      return id
    },

    get(id) {
      return jobs.get(id)
    },

    setProcessing(id, step) {
      const job = jobs.get(id)
      if (!job) return
      job.status = 'processing'
      job.step = step
      job.startedAt ??= new Date().toISOString()
      this.notify(id, { type: 'status', status: 'processing', step })
    },

    complete(id, result) {
      const job = jobs.get(id)
      if (!job) return
      job.status = 'completed'
      job.result = result
      job.finishedAt = new Date().toISOString()
      this.notify(id, { type: 'completed', result })
    },

    fail(id, error) {
      const job = jobs.get(id)
      if (!job) return
      job.status = 'failed'
      job.error = error
      job.finishedAt = new Date().toISOString()
      this.notify(id, { type: 'failed', error })
    },

    subscribe(id, listener) {
      if (!subscribers.has(id)) subscribers.set(id, new Set())
      subscribers.get(id)!.add(listener)
      return () => subscribers.get(id)?.delete(listener)
    },

    notify(id, event) {
      subscribers.get(id)?.forEach((fn) => fn(event))
    },
  }
}
