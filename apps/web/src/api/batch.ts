const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://127.0.0.1:3000'

export interface BatchJobItem {
  jobId: string
  filename: string
  status: string
}

export interface BatchResponse {
  jobs: BatchJobItem[]
  errors: Array<{ filename: string; error: string }>
}

export interface MetricsResponse {
  total: number
  byStatus: Record<string, number>
  avgDurationMs: number | null
  errorRate: number
}

export async function submitBatch(files: File[]): Promise<BatchResponse> {
  const form = new FormData()
  for (const file of files) form.append('files[]', file)

  const res = await fetch(`${API_BASE}/jobs/batch`, { method: 'POST', body: form })
  const body = await res.json() as BatchResponse & { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Erro ao enviar arquivos.')
  return body
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(body.error)
  }
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  const res = await fetch(`${API_BASE}/metrics`)
  if (!res.ok) throw new Error('Erro ao buscar métricas.')
  return res.json() as Promise<MetricsResponse>
}
