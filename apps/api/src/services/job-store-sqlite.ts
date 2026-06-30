import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { JobStore, JobRecord, JobStatus, JobEvent } from './job-store.js'

// Exported so tests can import the same factory name used by production code
export { createSqliteJobStore }

function createSqliteJobStore(dbPath: string): JobStore {
  const jobs = new Map<string, JobRecord>()
  const subscribers = new Map<string, Set<(event: JobEvent) => void>>()
  const persist = dbPath !== ':memory:'

  if (persist) {
    mkdirSync(dirname(dbPath), { recursive: true })
    try {
      const raw = readFileSync(dbPath, 'utf-8')
      const saved = JSON.parse(raw) as JobRecord[]
      for (const job of saved) jobs.set(job.id, job)
    } catch {
      // file doesn't exist yet — start fresh
    }
  }

  function save() {
    if (!persist) return
    writeFileSync(dbPath, JSON.stringify([...jobs.values()], null, 2), 'utf-8')
  }

  return {
    create(filename, mimeType) {
      const id = randomUUID()
      jobs.set(id, {
        id, status: 'queued', filename, mimeType,
        createdAt: new Date().toISOString(),
      })
      save()
      return id
    },

    get(id) { return jobs.get(id) },

    list() {
      const arr = [...jobs.values()]
      return arr.sort((a, b) => {
        const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        return diff !== 0 ? diff : b.id.localeCompare(a.id)
      })
    },

    setProcessing(id, step) {
      const job = jobs.get(id)
      if (!job) return
      job.status = 'processing'
      job.step = step
      job.startedAt ??= new Date().toISOString()
      save()
      this.notify(id, { type: 'status', status: 'processing', step })
    },

    complete(id, result) {
      const job = jobs.get(id)
      if (!job) return
      job.status = 'completed'
      job.result = result
      job.finishedAt = new Date().toISOString()
      save()
      this.notify(id, { type: 'completed', result })
    },

    fail(id, error) {
      const job = jobs.get(id)
      if (!job) return
      job.status = 'failed'
      job.error = error
      job.finishedAt = new Date().toISOString()
      save()
      this.notify(id, { type: 'failed', error })
    },

    cancel(id) {
      const job = jobs.get(id)
      if (!job) return false
      if (['completed', 'failed', 'canceled'].includes(job.status)) return false
      job.status = 'canceled'
      job.finishedAt = new Date().toISOString()
      save()
      this.notify(id, { type: 'canceled' })
      return true
    },

    updateFields(id, documentType, fields) {
      const job = jobs.get(id)
      if (!job?.result) return false
      job.result = { ...job.result, extraction: { ...job.result.extraction, documentType, fields } }
      save()
      return true
    },

    getMetrics() {
      const all = [...jobs.values()]
      const byStatus: Record<JobStatus, number> = {
        queued: 0, processing: 0, completed: 0, failed: 0, canceled: 0,
      }
      for (const j of all) byStatus[j.status]++

      const finished = all.filter(
        (j) => j.status === 'completed' && j.startedAt && j.finishedAt,
      )
      const avgDurationMs = finished.length > 0
        ? finished.reduce(
            (sum, j) => sum + new Date(j.finishedAt!).getTime() - new Date(j.startedAt!).getTime(),
            0,
          ) / finished.length
        : null

      return {
        total: all.length,
        byStatus,
        avgDurationMs,
        errorRate: all.length > 0 ? byStatus.failed / all.length : 0,
      }
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
