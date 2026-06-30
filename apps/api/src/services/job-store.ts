import type { OcrResult, ExtractedField } from '@ocr-reader/shared'

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled'

export interface JobEvent {
  type: 'status' | 'completed' | 'failed' | 'canceled'
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

export interface JobMetrics {
  total: number
  byStatus: Record<JobStatus, number>
  avgDurationMs: number | null
  errorRate: number
}

export interface JobStore {
  create(filename: string, mimeType: string): string
  get(id: string): JobRecord | undefined
  list(): JobRecord[]
  setProcessing(id: string, step: string): void
  complete(id: string, result: OcrResult): void
  fail(id: string, error: string): void
  cancel(id: string): boolean
  updateFields(id: string, documentType: string | null, fields: Record<string, ExtractedField>): boolean
  getMetrics(): JobMetrics
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

    list() {
      return [...jobs.values()].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
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

    cancel(id) {
      const job = jobs.get(id)
      if (!job) return false
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') {
        return false
      }
      job.status = 'canceled'
      job.finishedAt = new Date().toISOString()
      this.notify(id, { type: 'canceled' })
      return true
    },

    updateFields(id, documentType, fields) {
      const job = jobs.get(id)
      if (!job || !job.result) return false
      job.result = {
        ...job.result,
        extraction: { ...job.result.extraction, documentType, fields },
      }
      return true
    },

    getMetrics() {
      const all = [...jobs.values()]
      const byStatus = { queued: 0, processing: 0, completed: 0, failed: 0, canceled: 0 }
      for (const j of all) byStatus[j.status]++

      const finished = all.filter(
        (j) => j.status === 'completed' && j.startedAt && j.finishedAt,
      )
      const avgDurationMs =
        finished.length > 0
          ? finished.reduce(
              (sum, j) =>
                sum + new Date(j.finishedAt!).getTime() - new Date(j.startedAt!).getTime(),
              0,
            ) / finished.length
          : null

      const errorRate = all.length > 0 ? byStatus.failed / all.length : 0

      return { total: all.length, byStatus, avgDurationMs, errorRate }
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
